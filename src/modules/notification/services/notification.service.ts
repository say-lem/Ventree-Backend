import { NotificationRepository, CreateNotificationDto, QueryFilters } from '../repositories/notification.repository';
import { INotification } from '../schemas/notification.schema';
import { VectorClockUtil, VectorClock } from '../utils/vector-clock.util';
import { NotificationTemplateUtil } from '../utils/notification-template.util';
import { NotificationType, RecipientType } from '../types/notification-types';
import { MockAuthContext } from '../interfaces/mock-auth.interface';
import { BadRequestError, NotFoundError, AuthorizationError } from '../../../shared/utils/AppError';

/**
 * Create Notification Input
 */
export interface CreateNotificationInput {
  shopId: number;
  recipientType: RecipientType;
  recipientId?: number;
  message: string;
  type: NotificationType;
  inventoryId?: number;
  metadata?: Record<string, any>;
  authContext: MockAuthContext;
}

/**
 * Query Notifications Input
 */
export interface QueryNotificationsInput {
  shopId: number;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
  type?: string;
  authContext: MockAuthContext;
}

/**
 * Mark Read Input
 */
export interface MarkReadInput {
  notificationIds: string[];
  authContext: MockAuthContext;
}

/**
 * Notification Service
 * Implements business logic for notification management
 */
export class NotificationService {
  private repository: NotificationRepository;

  constructor(repository?: NotificationRepository) {
    this.repository = repository || new NotificationRepository();
  }

  /**
   * Create a new notification
   */
  async createNotification(input: CreateNotificationInput): Promise<INotification> {
    const { shopId, recipientType, recipientId, message, type, inventoryId, metadata, authContext } = input;

    // Validate shop ownership (mock - will be replaced with real ShopService)
    await this.validateShopAccess(shopId, authContext);

    // Initialize vector clock with replica ID
    const vectorClock = VectorClockUtil.init(authContext.replicaId);

    // Determine recipients
    let ownerProfileId: number | undefined;
    let staffId: number | undefined;

    if (recipientType === 'owner') {
      ownerProfileId = recipientId;
    } else if (recipientType === 'staff') {
      staffId = recipientId;
      // Validate staff belongs to shop (mock)
      if (staffId !== undefined) {
        await this.validateStaffBelongsToShop(staffId, shopId);
      }
    } else if (recipientType === 'all') {
      // Broadcast to all - will create multiple notifications
      return await this.createBroadcastNotification(input);
    }

    const notificationData: CreateNotificationDto = {
      shopId,
      ownerProfileId,
      staffId,
      inventoryId,
      message,
      type,
      metadata,
      vectorClock,
    };

    const notification = await this.repository.create(notificationData);

    // TODO: Emit via WebSocket/Redis when available
    // await this.emitNotification(notification);

    return notification;
  }

  /**
   * Create broadcast notification (to all users in shop)
   */
  private async createBroadcastNotification(input: CreateNotificationInput): Promise<INotification> {
    // For now, create a single notification without specific recipient
    // In production, this would create multiple notifications or use a broadcast flag
    const vectorClock = VectorClockUtil.init(input.authContext.replicaId);

    const notificationData: CreateNotificationDto = {
      shopId: input.shopId,
      message: input.message,
      type: input.type,
      inventoryId: input.inventoryId,
      metadata: input.metadata,
      vectorClock,
    };

    return await this.repository.create(notificationData);
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
      recipientId: authContext.profileId,
      recipientType: authContext.role === 'ownerProfile' ? 'owner' : 'staff',
    };

    const notifications = await this.repository.findByShop(shopId, queryFilters);
    const total = await this.repository.countByShop(shopId, queryFilters);

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
  async getNotificationById(id: string, authContext: MockAuthContext): Promise<INotification> {
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
  async markAsRead(id: string, authContext: MockAuthContext): Promise<INotification> {
    const notification = await this.repository.findById(id);

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    // Validate access
    await this.validateNotificationAccess(notification, authContext);

    // Increment vector clock
    const newVectorClock = VectorClockUtil.increment(
      notification.vectorClock,
      authContext.replicaId
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
    const vectorClock = VectorClockUtil.init(authContext.replicaId);
    const incrementedClock = VectorClockUtil.increment(vectorClock, authContext.replicaId);

    return await this.repository.bulkMarkAsRead(notificationIds, incrementedClock);
  }

  /**
   * Get unread count
   */
  async getUnreadCount(shopId: number, authContext: MockAuthContext): Promise<number> {
    await this.validateShopAccess(shopId, authContext);

    return await this.repository.countUnread(
      shopId,
      authContext.profileId,
      authContext.role
    );
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string, authContext: MockAuthContext): Promise<void> {
    const notification = await this.repository.findById(id);

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    // Only owner can delete shop-wide notifications
    // Staff can delete their own notifications
    if (authContext.role === 'staff' && notification.staffId !== authContext.profileId) {
      throw new AuthorizationError('You can only delete your own notifications');
    }

    await this.repository.delete(id);
  }

  /**
   * Create notification from template
   */
  async createFromTemplate(
    shopId: number,
    type: NotificationType,
    data: any,
    recipientType: RecipientType,
    recipientId: number | undefined,
    authContext: MockAuthContext
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
  async getNotificationsSince(shopId: number, since: Date, authContext: MockAuthContext): Promise<INotification[]> {
    await this.validateShopAccess(shopId, authContext);
    return await this.repository.getNotificationsSince(shopId, since);
  }

  /**
   * Validate shop access (mock implementation)
   */
  private async validateShopAccess(shopId: number, authContext: MockAuthContext): Promise<void> {
    if (authContext.shopId !== shopId) {
      throw new AuthorizationError('You do not have access to this shop');
    }
    // TODO: Replace with real ShopService validation
  }

  /**
   * Validate staff belongs to shop (mock implementation)
   */
  private async validateStaffBelongsToShop(staffId: number, shopId: number): Promise<void> {
    // TODO: Replace with real StaffService validation
    // For now, assume valid
  }

  /**
   * Validate notification access
   */
  private async validateNotificationAccess(
    notification: INotification,
    authContext: MockAuthContext
  ): Promise<void> {
    // Check if user has access to this notification
    if (notification.shopId !== authContext.shopId) {
      throw new AuthorizationError('You do not have access to this notification');
    }

    if (authContext.role === 'ownerProfile') {
      // Owner can access all notifications in their shop
      return;
    }

    if (authContext.role === 'staff') {
      // Staff can only access their own notifications
      if (notification.staffId !== authContext.profileId) {
        throw new AuthorizationError('You can only access your own notifications');
      }
    }
  }
}
