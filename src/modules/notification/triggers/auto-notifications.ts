import { NotificationService } from '../services/notification.service';
import { getNotificationService } from '../services/notification.service.instance';
import { NotificationSettingsService } from '../services/notification-settings.service';
import { NotificationType } from '../types/notification-types';
import { NotificationTemplateUtil } from '../utils/notification-template.util';
import { TokenPayload } from '../../../shared/middleware/auth.middleware';

/**
 * Auto Notification Triggers
 * Handles automatic notifications with settings-based filtering
 */
export class AutoNotificationTriggers {
  private static notificationService: NotificationService | null = null;
  private static settingsService: NotificationSettingsService = new NotificationSettingsService();
  private static readonly SYSTEM_PROFILE_PREFIX = 'system-profile';
  private static readonly SYSTEM_USER_ID_PREFIX = 'system-user';

  /**
   * Get notification service instance (singleton with Redis emitter)
   */
  private static getNotificationService(): NotificationService {
    if (!this.notificationService) {
      this.notificationService = getNotificationService();
    }
    return this.notificationService;
  }
  private static resolveAuthContext(shopId: string, authContext?: TokenPayload): TokenPayload {
    if (authContext) {
      if (authContext.shopId !== shopId) {
        console.warn(
          '[AutoNotificationTriggers] Provided auth context does not match shop. Falling back to system context.',
          {
            expectedShopId: shopId,
            providedShopId: authContext.shopId,
          }
        );
      } else {
        return authContext;
      }
    }

    const systemId = `${this.SYSTEM_USER_ID_PREFIX}:${shopId}`;

    return {
      id: `${this.SYSTEM_PROFILE_PREFIX}:${shopId}`,
      shopId,
      role: 'owner',
      profileId: `${this.SYSTEM_PROFILE_PREFIX}:${shopId}`,
      staffName: 'System',
    };
  }

  /**
   * Trigger low stock notification
   * Checks settings before sending
   */
  static async onLowStock(
    inventoryId: string,
    shopId: string,
    productName: string,
    quantity: number,
    unit: string,
    threshold: number,
    authContext?: TokenPayload
  ): Promise<void> {
    try {
      // Check if low stock notifications are enabled
      const isEnabled = await this.settingsService.isNotificationEnabled(shopId, 'low_stock');
      
      if (!isEnabled) {
        console.log(`[AutoNotificationTriggers.onLowStock] Skipped - low stock notifications disabled for shop ${shopId}`);
        return;
      }

      const data = {
        productName,
        quantity,
        unit,
        threshold,
        inventoryId,
      };

      const message = NotificationTemplateUtil.generate(NotificationType.LOW_STOCK, data);

      const context = this.resolveAuthContext(shopId, authContext);

      await this.getNotificationService().createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.LOW_STOCK,
        inventoryId,
        metadata: data,
        authContext: context,
      });
    } catch (error) {
      console.error('[AutoNotificationTriggers.onLowStock] Failed to create notification', {
        shopId,
        inventoryId,
        error,
      });
    }
  }

  /**
   * Trigger out of stock notification
   * Checks settings before sending
   */
  static async onOutOfStock(
    inventoryId: string,
    shopId: string,
    productName: string,
    authContext?: TokenPayload
  ): Promise<void> {
    try {
      // Check if out of stock notifications are enabled
      const isEnabled = await this.settingsService.isNotificationEnabled(shopId, 'out_of_stock');
      
      if (!isEnabled) {
        console.log(`[AutoNotificationTriggers.onOutOfStock] Skipped - out of stock notifications disabled for shop ${shopId}`);
        return;
      }

      const data = {
        productName,
        inventoryId,
      };

      const message = NotificationTemplateUtil.generate(NotificationType.OUT_OF_STOCK, data);

      const context = this.resolveAuthContext(shopId, authContext);

      await this.getNotificationService().createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.OUT_OF_STOCK,
        inventoryId,
        metadata: data,
        authContext: context,
      });
    } catch (error) {
      console.error('[AutoNotificationTriggers.onOutOfStock] Failed to create notification', {
        shopId,
        inventoryId,
        error,
      });
    }
  }

  /**
   * Trigger sale completion notification
   * Checks settings before sending
   */
  static async onSaleCompleted(
    saleId: string,
    shopId: string,
    staffId: string,
    itemCount: number,
    total: number,
    currency: string,
    staffName: string,
    authContext?: TokenPayload
  ): Promise<void> {
    try {
      // Check if sale completed notifications are enabled
      const isEnabled = await this.settingsService.isNotificationEnabled(shopId, 'sale_completed');
      
      if (!isEnabled) {
        console.log(`[AutoNotificationTriggers.onSaleCompleted] Skipped - sale completed notifications disabled for shop ${shopId}`);
        return;
      }

      const data = {
        saleId,
        itemCount,
        total,
        currency,
        staffName,
      };

      const message = NotificationTemplateUtil.generate(NotificationType.SALE_COMPLETED, data);

      // Notify owner about the sale
      const context = this.resolveAuthContext(shopId, authContext);

      await this.getNotificationService().createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.SALE_COMPLETED,
        metadata: data,
        authContext: context,
      });
    } catch (error) {
      console.error('[AutoNotificationTriggers.onSaleCompleted] Failed to create notification', {
        shopId,
        saleId,
        error,
      });
    }
  }

}
