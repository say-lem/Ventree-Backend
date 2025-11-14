import { NotificationModel, INotification } from '../models/notification.model';
import { FlattenMaps, Types } from 'mongoose';
import { VectorClock, VectorClockUtil } from '../utils/vector-clock.util';
import { NotFoundError } from '../../../shared/utils/AppError';

/**
 * Query Filters for Notifications
 */
export interface QueryFilters {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
  type?: string;
  recipientId?: string;
  recipientType?: 'owner' | 'staff';
}

/**
 * Internal Notification Data (for repository operations)
 */
interface NotificationData {
  shopId: Types.ObjectId;
  staffId?: Types.ObjectId;
  inventoryId?: Types.ObjectId; // ObjectId for production
  message: string;
  type: 'low_stock' | 'out_of_stock' | 'sale_completed' | 'inventory_updated' | 'staff_action' | 'staff_created' | 'staff_deleted' | 'expense_added' | 'system_alert' | 'system' | 'custom';
  metadata?: Record<string, any>;
  vectorClock: VectorClock;
}

/**
 * Notification Repository
 * Implements repository pattern for data access
 */
export class NotificationRepository {
  /**
   * Create a new notification
   */
  async create(data: NotificationData): Promise<INotification> {
    const notification = new NotificationModel(data);
    await notification.save();
    return notification;
  }

  /**
   * Find notification by ID
   */
  async findById(id: string): Promise<INotification | null> {
    return await NotificationModel.findById(id);
  }

  /**
   * Find notifications by shop with filters
   */
  async findByShop(shopId: Types.ObjectId, filters: QueryFilters): Promise<FlattenMaps<INotification>[]> {
    const query: any = { shopId };

    // Filter by recipient
    if (filters.recipientId && filters.recipientType) {
      if (filters.recipientType === 'staff') {
        query.staffId = new Types.ObjectId(filters.recipientId);
      } else if (filters.recipientType === 'owner') {
        // For owner, show all notifications without staffId (broadcast) or no specific recipient
        query.$or = [{ staffId: { $exists: false } }, { staffId: null }];
      }
    }

    // Filter by read status
    if (filters.unreadOnly !== undefined) {
      query.isRead = !filters.unreadOnly;
    }

    // Filter by type
    if (filters.type) {
      query.type = filters.type;
    }

    // Filter by date range
    if (filters.fromDate || filters.toDate) {
      query.created_at = {};
      if (filters.fromDate) {
        query.created_at.$gte = filters.fromDate;
      }
      if (filters.toDate) {
        query.created_at.$lte = filters.toDate;
      }
    }

    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    return await NotificationModel.find(query)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, vectorClock: VectorClock): Promise<INotification> {
    const notification = await NotificationModel.findById(id);

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    // Merge vector clocks (CRDT merge)
    notification.vectorClock = VectorClockUtil.merge(
      notification.vectorClock,
      vectorClock
    );
    notification.isRead = true;
    notification.updated_at = new Date();

    await notification.save();
    return notification;
  }

  /**
   * Bulk mark notifications as read
   */
  async bulkMarkAsRead(ids: string[], vectorClock: VectorClock): Promise<number> {
    const result = await NotificationModel.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          isRead: true,
          vectorClock: vectorClock,
          updated_at: new Date(),
        },
      }
    );

    return result.modifiedCount;
  }

  /**
   * Count unread notifications
   */
  async countUnread(shopId: Types.ObjectId, recipientId: string | undefined, role: 'owner' | 'staff'): Promise<number> {
    const query: any = {
      shopId,
      isRead: false,
    };

    if (role === 'staff' && recipientId) {
      query.staffId = new Types.ObjectId(recipientId);
    } else if (role === 'owner') {
      // Owner sees all notifications or those without specific staff recipient
      query.$or = [{ staffId: { $exists: false } }, { staffId: null }];
    }

    return await NotificationModel.countDocuments(query);
  }

  /**
   * Delete notification (hard delete)
   */
  async delete(id: string): Promise<boolean> {
    const result = await NotificationModel.findByIdAndDelete(id);
    return result !== null;
  }

  /**
   * Soft delete notification (mark as deleted)
   */
  async softDelete(id: string): Promise<boolean> {
    const result = await NotificationModel.findByIdAndUpdate(
      id,
      { $set: { isRead: true, updated_at: new Date() } },
      { new: true }
    );
    return result !== null;
  }

  /**
   * Count total notifications for a shop
   */
  async countByShop(shopId: Types.ObjectId, filters?: QueryFilters): Promise<number> {
    const query: any = { shopId };

    if (filters?.recipientId && filters?.recipientType) {
      if (filters.recipientType === 'staff') {
        query.staffId = new Types.ObjectId(filters.recipientId);
      } else if (filters.recipientType === 'owner') {
        query.$or = [{ staffId: { $exists: false } }, { staffId: null }];
      }
    }

    if (filters?.unreadOnly) {
      query.isRead = false;
    }

    if (filters?.type) {
      query.type = filters.type;
    }

    return await NotificationModel.countDocuments(query);
  }

  /**
   * Get notifications created after a specific timestamp (for sync)
   */
  async getNotificationsSince(shopId: Types.ObjectId, since: Date): Promise<FlattenMaps<INotification>[]> {
    return await NotificationModel.find({
      shopId,
      created_at: { $gt: since },
    })
      .sort({ created_at: 1 })
      .lean();
  }

  /**
   * Bulk create notifications (for batch operations)
   */
  async bulkCreate(notifications: NotificationData[]): Promise<INotification[]> {
    const result = await NotificationModel.insertMany(notifications);
    return result as INotification[];
  }
}
