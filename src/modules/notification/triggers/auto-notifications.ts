import { NotificationService } from '../services/notification.service';
import { NotificationType } from '../types/notification-types';
import { NotificationTemplateUtil } from '../utils/notification-template.util';
import { MockAuthContext } from '../interfaces/mock-auth.interface';

/**
 * Auto Notification Triggers
 * Stubs for automatic notifications that will be integrated with other services
 */
export class AutoNotificationTriggers {
  private static notificationService = new NotificationService();

  /**
   * Trigger low stock notification
   * TODO: Integrate with InventoryService
   */
  static async onLowStock(
    inventoryId: number,
    shopId: number,
    productName: string,
    quantity: number,
    unit: string,
    threshold: number,
    authContext: MockAuthContext
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

      await this.notificationService.createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.LOW_STOCK,
        inventoryId,
        metadata: data,
        authContext,
      });
    } catch (error) {
      // Log error but don't throw to prevent blocking inventory operations
    }
  }

  /**
   * Trigger out of stock notification
   * TODO: Integrate with InventoryService
   */
  static async onOutOfStock(
    inventoryId: number,
    shopId: number,
    productName: string,
    authContext: MockAuthContext
  ): Promise<void> {
    try {
      const data = {
        productName,
        inventoryId,
      };

      const message = NotificationTemplateUtil.generate(NotificationType.OUT_OF_STOCK, data);

      await this.notificationService.createNotification({
        shopId,
        recipientType: 'all',
        message,
        type: NotificationType.OUT_OF_STOCK,
        inventoryId,
        metadata: data,
        authContext,
      });
    } catch (error) {
      // Log error but don't throw
    }
  }

  /**
   * Trigger sale completion notification
   * TODO: Integrate with SalesService
   */
  static async onSaleCompleted(
    saleId: string,
    shopId: number,
    staffId: number,
    itemCount: number,
    total: number,
    currency: string,
    staffName: string,
    authContext: MockAuthContext
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
      await this.notificationService.createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.SALE_COMPLETED,
        metadata: data,
        authContext,
      });
    } catch (error) {
      // Log error but don't throw
    }
  }

  /**
   * Trigger inventory update notification
   * TODO: Integrate with InventoryService
   */
  static async onInventoryUpdated(
    inventoryId: number,
    shopId: number,
    productName: string,
    oldQuantity: number,
    newQuantity: number,
    unit: string,
    updatedBy: string,
    authContext: MockAuthContext
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
      await this.notificationService.createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.INVENTORY_UPDATED,
        inventoryId,
        metadata: data,
        authContext,
      });
    } catch (error) {
      // Log error but don't throw
    }
  }

  /**
   * Trigger staff created notification
   * TODO: Integrate with StaffService
   */
  static async onStaffCreated(
    shopId: number,
    staffName: string,
    performedBy: string,
    authContext: MockAuthContext
  ): Promise<void> {
    try {
      const data = {
        staffName,
        action: 'created' as const,
        performedBy,
      };

      const message = NotificationTemplateUtil.generate(NotificationType.STAFF_CREATED, data);

      await this.notificationService.createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.STAFF_CREATED,
        metadata: data,
        authContext,
      });
    } catch (error) {
      // Log error but don't throw
    }
  }

  /**
   * Trigger staff deleted notification
   * TODO: Integrate with StaffService
   */
  static async onStaffDeleted(
    shopId: number,
    staffName: string,
    performedBy: string,
    authContext: MockAuthContext
  ): Promise<void> {
    try {
      const data = {
        staffName,
        action: 'deleted' as const,
        performedBy,
      };

      const message = NotificationTemplateUtil.generate(NotificationType.STAFF_DELETED, data);

      await this.notificationService.createNotification({
        shopId,
        recipientType: 'owner',
        message,
        type: NotificationType.STAFF_DELETED,
        metadata: data,
        authContext,
      });
    } catch (error) {
      // Log error but don't throw
    }
  }

  /**
   * Trigger system alert notification
   * Can be used for general system notifications
   */
  static async onSystemAlert(
    shopId: number,
    alertType: 'warning' | 'error' | 'info',
    message: string,
    details: string | undefined,
    authContext: MockAuthContext
  ): Promise<void> {
    try {
      const data = {
        alertType,
        message,
        details,
      };

      const notificationMessage = NotificationTemplateUtil.generate(NotificationType.SYSTEM_ALERT, data);

      await this.notificationService.createNotification({
        shopId,
        recipientType: 'all',
        message: notificationMessage,
        type: NotificationType.SYSTEM_ALERT,
        metadata: data,
        authContext,
      });
    } catch (error) {
      // Log error but don't throw
    }
  }
}
