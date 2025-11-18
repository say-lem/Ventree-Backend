import { NotificationService } from '../services/notification.service';
import { getNotificationService } from '../services/notification.service.instance';
import { NotificationType } from '../types/notification-types';
import { NotificationTemplateUtil } from '../utils/notification-template.util';
import { TokenPayload } from '../../../shared/middleware/auth.middleware';

/**
 * Auto Notification Triggers
 * Stubs for automatic notifications that will be integrated with other services
 */
export class AutoNotificationTriggers {
  private static notificationService: NotificationService | null = null;
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
   * Trigger low sto
   * ck notification
   * TODO: Integrate with InventoryService
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
   * TODO: Integrate with InventoryService
   */
  static async onOutOfStock(
    inventoryId: string,
    shopId: string,
    productName: string,
    authContext?: TokenPayload
  ): Promise<void> {
    try {
      const data = {
        productName,
        inventoryId,
      };

      const message = NotificationTemplateUtil.generate(NotificationType.OUT_OF_STOCK, data);

      const context = this.resolveAuthContext(shopId, authContext);

      await this.getNotificationService().createNotification({
        shopId,
        recipientType: 'all',
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
   * TODO: Integrate with SalesService
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

  /**
   * Trigger inventory update notification
   * TODO: Integrate with InventoryService
   */
  static async onInventoryUpdated(
    inventoryId: string,
    shopId: string,
    productName: string,
    oldQuantity: number,
    newQuantity: number,
    unit: string,
    updatedBy: string,
    authContext?: TokenPayload
  ): Promise<void> {
    try {
      const data = {
        productName,
        oldQuantity,
        newQuantity,
        unit,
        updatedBy,
        inventoryId,
      };

      const message = NotificationTemplateUtil.generate(NotificationType.INVENTORY_UPDATED, data);

      // Notify owner about inventory changes
      const context = this.resolveAuthContext(shopId, authContext);

      await this.getNotificationService().createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.INVENTORY_UPDATED,
        inventoryId,
        metadata: data,
        authContext: context,
      });
    } catch (error) {
      console.error('[AutoNotificationTriggers.onInventoryUpdated] Failed to create notification', {
        shopId,
        inventoryId,
        error,
      });
    }
  }

  /**
   * Trigger staff created notification
   * TODO: Integrate with StaffService
   */
  static async onStaffCreated(
    shopId: string,
    staffName: string,
    performedBy: string,
    authContext?: TokenPayload
  ): Promise<void> {
    try {
      const data = {
        staffName,
        action: 'created' as const,
        performedBy,
      };

      const message = NotificationTemplateUtil.generate(NotificationType.STAFF_CREATED, data);

      const context = this.resolveAuthContext(shopId, authContext);

      await this.getNotificationService().createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.STAFF_CREATED,
        metadata: data,
        authContext: context,
      });
    } catch (error) {
      console.error('[AutoNotificationTriggers.onStaffCreated] Failed to create notification', {
        shopId,
        staffName,
        error,
      });
    }
  }

  /**
   * Trigger staff deleted notification
   * TODO: Integrate with StaffService
   */
  static async onStaffDeleted(
    shopId: string,
    staffName: string,
    performedBy: string,
    authContext?: TokenPayload
  ): Promise<void> {
    try {
      const data = {
        staffName,
        action: 'deleted' as const,
        performedBy,
      };

      const message = NotificationTemplateUtil.generate(NotificationType.STAFF_DELETED, data);

      const context = this.resolveAuthContext(shopId, authContext);

      await this.getNotificationService().createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.STAFF_DELETED,
        metadata: data,
        authContext: context,
      });
    } catch (error) {
      console.error('[AutoNotificationTriggers.onStaffDeleted] Failed to create notification', {
        shopId,
        staffName,
        error,
      });
    }
  }

  /**
   * Trigger system alert notification
   * Can be used for general system notifications
   */
  static async onSystemAlert(
    shopId: string,
    alertType: 'warning' | 'error' | 'info',
    message: string,
    details: string | undefined,
    authContext?: TokenPayload
  ): Promise<void> {
    try {
      const data = {
        alertType,
        message,
        details,
      };

      const notificationMessage = NotificationTemplateUtil.generate(NotificationType.SYSTEM_ALERT, data);

      const context = this.resolveAuthContext(shopId, authContext);

      await this.getNotificationService().createNotification({
        shopId,
        recipientType: 'all',
        message: notificationMessage,
        type: NotificationType.SYSTEM_ALERT,
        metadata: data,
        authContext: context,
      });
    } catch (error) {
      console.error('[AutoNotificationTriggers.onSystemAlert] Failed to create notification', {
        shopId,
        alertType,
        error,
      });
    }
  }
}
