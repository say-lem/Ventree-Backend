import {
  NotificationSettingsModel,
  INotificationSettings,
} from '../models/notification-settings.model';
import { Types } from 'mongoose';

/**
 * Notification Settings Repository
 * Handles database operations for notification settings
 */
export class NotificationSettingsRepository {
  /**
   * Find settings by shop ID
   */
  async findByShopId(shopId: string): Promise<INotificationSettings | null> {
    return await NotificationSettingsModel.findOne({ shopId: new Types.ObjectId(shopId) });
  }

  /**
   * Create default settings for a shop
   */
  async create(shopId: string): Promise<INotificationSettings> {
    const settings = new NotificationSettingsModel({
      shopId: new Types.ObjectId(shopId),
      lowStockEnabled: true,
      outOfStockEnabled: true,
      saleCompletedEnabled: true,
    });
    await settings.save();
    return settings;
  }

  /**
   * Update settings
   */
  async update(
    shopId: string,
    updates: Partial<{
      lowStockEnabled: boolean;
      outOfStockEnabled: boolean;
      saleCompletedEnabled: boolean;
    }>
  ): Promise<INotificationSettings | null> {
    return await NotificationSettingsModel.findOneAndUpdate(
      { shopId: new Types.ObjectId(shopId) },
      { $set: updates },
      { new: true }
    );
  }

  /**
   * Get or create settings (ensures settings always exist)
   */
  async getOrCreate(shopId: string): Promise<INotificationSettings> {
    let settings = await this.findByShopId(shopId);
    if (!settings) {
      settings = await this.create(shopId);
    }
    return settings;
  }

  /**
   * Delete settings (for cleanup/testing)
   */
  async delete(shopId: string): Promise<boolean> {
    const result = await NotificationSettingsModel.deleteOne({
      shopId: new Types.ObjectId(shopId),
    });
    return result.deletedCount > 0;
  }
}


