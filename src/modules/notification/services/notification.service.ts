import { NotificationRepository, QueryFilters } from '../repositories/notification.repository';
import { INotification } from '../models/notification.model';
import { VectorClockUtil, VectorClock } from '../utils/vector-clock.util';
import { NotificationTemplateUtil } from '../utils/notification-template.util';
import { NotificationType, RecipientType } from '../types/notification-types';
import { TokenPayload } from '../../../shared/middleware/auth.middleware';
import { BadRequestError, NotFoundError, AuthorizationError } from '../../../shared/utils/AppError';
import { Types } from 'mongoose';
import { StaffService } from '../../staff-management/services/staff.service';
import { NotificationEmitter } from '../emitters/notification.emitter';

/**
 * Create Notification Input
 */
export interface CreateNotificationInput {
  shopId: string;
  recipientType: RecipientType;
  recipientId?: string;
  message: string;
  type: NotificationType;
  inventoryId?: string; // string/ObjectId (for production)
  metadata?: Record<string, any>;
  authContext: TokenPayload;
}

/**
 * Query Notifications Input
 */
export interface QueryNotificationsInput {
  shopId: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
  type?: string;
  authContext: TokenPayload;
}

/**
 * Mark Read Input
 */
export interface MarkReadInput {
  notificationIds: string[];
  authContext: TokenPayload;
}

/**
 * Notification Service
 * Implements business logic for notification management
 */
export class NotificationService {
  private repository: NotificationRepository;
  private staffService: StaffService;
  private emitter: NotificationEmitter | null;

  constructor(
    repository?: NotificationRepository,
    staffService?: StaffService,
    emitter?: NotificationEmitter | null
  ) {
    this.repository = repository || new NotificationRepository();
    this.staffService = staffService || new StaffService();
    this.emitter = emitter !== undefined ? emitter : null;
  }

  /**
   * Set the notification emitter (for Redis pub/sub)
   */
  setEmitter(emitter: NotificationEmitter): void {
    this.emitter = emitter;
  }

  /**
   * Create a new notification
   */
  async createNotification(input: CreateNotificationInput): Promise<INotification> {
    const { shopId, recipientType, recipientId, message, type, inventoryId, metadata, authContext } = input;

    // Validate shop access
    await this.validateShopAccess(shopId, authContext);

    // Check for duplicate inventory notifications (LOW_STOCK, OUT_OF_STOCK)
    // This prevents notification spam when stock fluctuates around threshold
    if (inventoryId && (type === NotificationType.LOW_STOCK || type === NotificationType.OUT_OF_STOCK)) {
      const deduplicationWindowMinutes = type === NotificationType.LOW_STOCK ? 24 * 60 : 60; // 24h for LOW_STOCK, 1h for OUT_OF_STOCK
      
      const recentNotification = await this.repository.findRecentNotification(
        new Types.ObjectId(shopId),
        new Types.ObjectId(inventoryId),
        type,
        deduplicationWindowMinutes
      );

      if (recentNotification) {
        const timeSinceLastMs = Date.now() - recentNotification.created_at.getTime();
        const minutesAgo = Math.floor(timeSinceLastMs / 60000);
        
        console.log(`[NotificationService] Duplicate ${type} notification suppressed for inventory ${inventoryId}. Last sent ${minutesAgo} minutes ago.`);
        
        // Return the recent notification instead of creating a duplicate
        // Do not re-emit to prevent double delivery to clients who already received it
        // Clients connecting after the original will fetch it via getNotifications API
        return recentNotification;
      }
    }

    // Initialize vector clock with shop ID as replica ID
    const vectorClock = VectorClockUtil.init(shopId);

    // Determine recipients
    let staffId: Types.ObjectId | undefined;

    if (recipientType === 'staff') {
      if (!recipientId) {
        throw new BadRequestError('Recipient ID is required for staff notifications');
      }
      staffId = new Types.ObjectId(recipientId);
      // Validate staff belongs to shop
      await this.validateStaffBelongsToShop(recipientId, shopId);
    } else if (recipientType === 'all') {
      // Broadcast to all - will create multiple notifications
      return await this.createBroadcastNotification(input);
    }
    // For 'owner' recipientType, staffId remains undefined (notification for owner)

    // Convert inventoryId string to ObjectId (already validated by DTO)
    let inventoryIdObj: Types.ObjectId | undefined;
    if (inventoryId && Types.ObjectId.isValid(inventoryId)) {
      inventoryIdObj = new Types.ObjectId(inventoryId);
    }

    const notificationData = {
      shopId: new Types.ObjectId(shopId),
      staffId,
      inventoryId: inventoryIdObj,
      message,
      type,
      metadata,
      vectorClock,
    };

    const notification = await this.repository.create(notificationData);

    // Emit via Redis if emitter is available
    await this.emitNotification(notification, shopId, recipientType, staffId);

    return notification;
  }

  /**
   * Create broadcast notification (to owner only)
   * 
   */
  private async createBroadcastNotification(input: CreateNotificationInput): Promise<INotification> {
    const { shopId, message, type, inventoryId, metadata } = input;

    const vectorClock = VectorClockUtil.init(shopId);

    // Convert inventoryId string to ObjectId (already validated by DTO)
    let inventoryIdObj: Types.ObjectId | undefined;
    if (inventoryId && Types.ObjectId.isValid(inventoryId)) {
      inventoryIdObj = new Types.ObjectId(inventoryId);
    }

    const notificationData = {
      shopId: new Types.ObjectId(shopId),
      inventoryId: inventoryIdObj,
      message,
      type,
      metadata,
      vectorClock,
    };

    const notification = await this.repository.create(notificationData);

    // Emit broadcast notification via Redis
    if (this.emitter) {
      try {
        await this.emitter.emitToShop(shopId, notification);
      } catch (error) {
        console.error('[NotificationService] Failed to emit broadcast notification:', error);
      }
    }

    return notification;
  }

  /**
   * Emit notification via Redis pub/sub
   * 
   * Strategy:
   * - 'all': Broadcast to shop channel (includes owner + staff)
   * - 'owner': Send ONLY to owner channel (prevents double-delivery)
   * - 'staff': Send ONLY to staff-specific channel
   */
  private async emitNotification(
    notification: INotification,
    shopId: string,
    recipientType: RecipientType,
    staffId?: Types.ObjectId
  ): Promise<void> {
    if (!this.emitter) {
      console.log('[NotificationService] Emitter not configured, skipping Redis publish');
      return; // Emitter not configured, skip
    }

    try {
      if (recipientType === 'all') {
        // Broadcast to entire shop (owners and staff)
        await this.emitter.emitToShop(shopId, notification);
      } else if (recipientType === 'staff' && staffId) {
        // Emit to specific staff member only
        await this.emitter.emitToStaff(shopId, staffId.toString(), notification);
      } else if (recipientType === 'owner') {
        // Emit to owner only, via dedicated owner channel
        // Owner will not receive a duplicate via the shop broadcast channel
        await this.emitter.emitToOwner(shopId, 'owner', notification);
      }
    } catch (error) {
      // Log but don't fail notification creation
      console.error('[NotificationService] Failed to emit notification via Redis:', error);
    }
  }
  /**
   * Get notifications for a user
   */
  async getNotifications(input: QueryNotificationsInput): Promise<{
    notifications: INotification[];
    total: number;
    page: number;
    pages: number;
  }> {
    const { shopId, authContext, ...filters } = input;

    // Validate shop access
    await this.validateShopAccess(shopId, authContext);

    // Build query filters
    const queryFilters: QueryFilters = {
      ...filters,
      recipientId: authContext.role === 'owner' ? undefined : authContext.profileId,
      recipientType: authContext.role,
    };

    const notifications = await this.repository.findByShop(new Types.ObjectId(shopId), queryFilters) as unknown as INotification[];
    const total = await this.repository.countByShop(new Types.ObjectId(shopId), queryFilters);

    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    const pages = Math.ceil(total / limit);

    return {
      notifications,
      total,
      page,
      pages,
    };
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(id: string, authContext: TokenPayload): Promise<INotification> {
    const notification = await this.repository.findById(id);

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    // Validate access
    await this.validateNotificationAccess(notification, authContext);

    return notification;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, authContext: TokenPayload): Promise<INotification> {
    const notification = await this.repository.findById(id);

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    // Validate access
    await this.validateNotificationAccess(notification, authContext);

    // Increment vector clock
    const newVectorClock = VectorClockUtil.increment(
      notification.vectorClock,
      authContext.shopId
    );

    return await this.repository.markAsRead(id, newVectorClock);
  }

  /**
   * Bulk mark notifications as read
   */
  async bulkMarkAsRead(input: MarkReadInput): Promise<number> {
    const { notificationIds, authContext } = input;

    // Validate all notifications belong to user
    for (const id of notificationIds) {
      const notification = await this.repository.findById(id);
      if (notification) {
        await this.validateNotificationAccess(notification, authContext);
      }
    }

    // Create merged vector clock
    const vectorClock = VectorClockUtil.init(authContext.shopId);
    const incrementedClock = VectorClockUtil.increment(vectorClock, authContext.shopId);

    return await this.repository.bulkMarkAsRead(notificationIds, incrementedClock);
  }

  /**
   * Get unread count
   */
  async getUnreadCount(shopId: string, authContext: TokenPayload): Promise<number> {
    await this.validateShopAccess(shopId, authContext);

    return await this.repository.countUnread(
      new Types.ObjectId(shopId),
      authContext.role === 'owner' ? undefined : authContext.profileId,
      authContext.role
    );
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string, authContext: TokenPayload): Promise<void> {
    const notification = await this.repository.findById(id);

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    // Only owner can delete shop-wide notifications
    // Staff can delete their own notifications
    if (authContext.role === 'staff') {
      if (!notification.staffId || notification.staffId.toString() !== authContext.profileId) {
        throw new AuthorizationError('You can only delete your own notifications');
      }
    }

    await this.repository.delete(id);
  }

  /**
   * Create notification from template
   */
  async createFromTemplate(
    shopId: string,
    type: NotificationType,
    data: any,
    recipientType: RecipientType,
    recipientId: string | undefined,
    authContext: TokenPayload
  ): Promise<INotification> {
    const message = NotificationTemplateUtil.generate(type, data);

    return await this.createNotification({
      shopId,
      recipientType,
      recipientId,
      message,
      type,
      metadata: data,
      authContext,
    });
  }

  /**
   * Get notifications since timestamp (for sync)
   */
  async getNotificationsSince(shopId: string, since: Date, authContext: TokenPayload): Promise<INotification[]> {
    await this.validateShopAccess(shopId, authContext);
    return await this.repository.getNotificationsSince(new Types.ObjectId(shopId), since) as unknown as INotification[];
  }

  /**
   * Validate shop access
   */
  private async validateShopAccess(shopId: string, authContext: TokenPayload): Promise<void> {
    if (authContext.shopId !== shopId) {
      throw new AuthorizationError('You do not have access to this shop');
    }
  }

  /**
   * Validate staff belongs to shop
   */
  private async validateStaffBelongsToShop(staffId: string, shopId: string): Promise<void> {
    try {
      const staff = await this.staffService.getStaffById(staffId, shopId, {
        requestId: 'notification-validation',
        userId: shopId,
        userRole: 'owner',
        userShopId: shopId,
        ip: 'internal',
      });
      
      if (staff.shopId.toString() !== shopId) {
        throw new AuthorizationError('Staff does not belong to this shop');
      }
    } catch (error) {
      throw new AuthorizationError('Invalid staff member');
    }
  }

  /**
   * Validate notification access
   */
  private async validateNotificationAccess(
    notification: INotification,
    authContext: TokenPayload
  ): Promise<void> {
    // Check if user has access to this notification
    if (notification.shopId.toString() !== authContext.shopId) {
      throw new AuthorizationError('You do not have access to this notification');
    }

    if (authContext.role === 'owner') {
      // Owner can access all notifications in their shop
      return;
    }

    if (authContext.role === 'staff') {
      // Staff can only access their own notifications
      if (!notification.staffId || notification.staffId.toString() !== authContext.profileId) {
        throw new AuthorizationError('You can only access your own notifications');
      }
    }
  }
}
