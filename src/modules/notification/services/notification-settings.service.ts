import { NotificationSettingsRepository } from '../repositories/notification-settings.repository';
import { INotificationSettings } from '../models/notification-settings.model';
import { TokenPayload } from '../../../shared/middleware/auth.middleware';
import { BadRequestError, NotFoundError, AuthorizationError } from '../../../shared/utils/AppError';

/**
 * Update Settings Input
 */
export interface UpdateSettingsInput {
  shopId: string;
  lowStockEnabled?: boolean;
  outOfStockEnabled?: boolean;
  saleCompletedEnabled?: boolean;
  authContext: TokenPayload;
}

/**
 * Notification Settings Service
 * Manages notification preferences for shops
 */
export class NotificationSettingsService {
  private repository: NotificationSettingsRepository;

  constructor(repository?: NotificationSettingsRepository) {
    this.repository = repository || new NotificationSettingsRepository();
  }

  /**
   * Validate shop access and owner role
   * Only shop owners can manage notification settings
   */
  private validateShopAccess(shopId: string, authContext: TokenPayload): void {
    if (authContext.shopId !== shopId) {
      throw new AuthorizationError('You do not have access to this shop');
    }

    // Only owners can manage notification settings
    if (authContext.role !== 'owner') {
      throw new AuthorizationError('Only shop owners can manage notification settings');
    }
  }

  /**
   * Get notification settings for a shop
   */
  async getSettings(shopId: string, authContext: TokenPayload): Promise<INotificationSettings> {
    this.validateShopAccess(shopId, authContext);

    // Get or create settings (ensures every shop has settings)
    const settings = await this.repository.getOrCreate(shopId);
    return settings;
  }

  /**
   * Update notification settings
   */
  async updateSettings(input: UpdateSettingsInput): Promise<INotificationSettings> {
    const { shopId, lowStockEnabled, outOfStockEnabled, saleCompletedEnabled, authContext } = input;

    this.validateShopAccess(shopId, authContext);

    // Ensure settings exist
    await this.repository.getOrCreate(shopId);

    // Build updates object
    const updates: Partial<{
      lowStockEnabled: boolean;
      outOfStockEnabled: boolean;
      saleCompletedEnabled: boolean;
    }> = {};

    if (lowStockEnabled !== undefined) {
      updates.lowStockEnabled = lowStockEnabled;
    }
    if (outOfStockEnabled !== undefined) {
      updates.outOfStockEnabled = outOfStockEnabled;
    }
    if (saleCompletedEnabled !== undefined) {
      updates.saleCompletedEnabled = saleCompletedEnabled;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestError('At least one setting must be provided');
    }

    const updatedSettings = await this.repository.update(shopId, updates);

    if (!updatedSettings) {
      throw new NotFoundError('Settings not found');
    }

    return updatedSettings;
  }

  /**
   * Create default settings for a new shop
   * Called during shop registration
   */
  async createDefaultSettings(shopId: string): Promise<INotificationSettings> {
    try {
      const existingSettings = await this.repository.findByShopId(shopId);
      if (existingSettings) {
        return existingSettings;
      }
      return await this.repository.create(shopId);
    } catch (error) {
      console.error('[NotificationSettingsService] Failed to create default settings:', error);
      throw error;
    }
  }

  /**
   * Check if a specific notification type is enabled
   * Used by auto-triggers before sending notifications
   */
  async isNotificationEnabled(
    shopId: string,
    notificationType: 'low_stock' | 'out_of_stock' | 'sale_completed'
  ): Promise<boolean> {
    try {
      const settings = await this.repository.getOrCreate(shopId);

      switch (notificationType) {
        case 'low_stock':
          return settings.lowStockEnabled;
        case 'out_of_stock':
          return settings.outOfStockEnabled;
        case 'sale_completed':
          return settings.saleCompletedEnabled;
        default:
          return true; // Other notification types are always enabled
      }
    } catch (error) {
      console.error('[NotificationSettingsService] Error checking notification enabled:', error);
      // Fail open - if we can't check settings, allow the notification
      return true;
    }
  }
}

