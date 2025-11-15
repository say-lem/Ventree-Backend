import {
  NotificationType,
  LowStockData,
  OutOfStockData,
  SaleCompletedData,
  InventoryUpdatedData,
  StaffActionData,
  SystemAlertData,
} from '../types/notification-types';

/**
 * Notification Template Utility
 * Generates human-readable messages from notification data
 */
export class NotificationTemplateUtil {
  /**
   * Generate notification message based on type and data
   */
  static generate(type: NotificationType, data: any): string {
    const templates: Record<NotificationType, (data: any) => string> = {
      [NotificationType.LOW_STOCK]: (d: LowStockData) =>
        `⚠️ Low stock alert: ${d.productName} has only ${d.quantity} ${d.unit} left (threshold: ${d.threshold}).`,

      [NotificationType.OUT_OF_STOCK]: (d: OutOfStockData) =>
        `🚨 ${d.productName} is out of stock! Please restock immediately.`,

      [NotificationType.SALE_COMPLETED]: (d: SaleCompletedData) =>
        `✅ Sale completed: ${d.itemCount} item${d.itemCount > 1 ? 's' : ''}, Total: ${d.total} ${d.currency}${d.staffName ? ` by ${d.staffName}` : ''}.`,

      [NotificationType.INVENTORY_UPDATED]: (d: InventoryUpdatedData) =>
        `📦 Inventory updated: ${d.productName} changed from ${d.oldQuantity} to ${d.newQuantity} ${d.unit} by ${d.updatedBy}.`,

      [NotificationType.STAFF_ACTION]: (d: StaffActionData) =>
        `👤 Staff member ${d.staffName} was ${d.action} by ${d.performedBy}.`,

      [NotificationType.STAFF_CREATED]: (d: StaffActionData) =>
        `👤 New staff member ${d.staffName} was ${d.action} by ${d.performedBy}.`,

      [NotificationType.STAFF_DELETED]: (d: StaffActionData) =>
        `👤 Staff member ${d.staffName} was ${d.action} by ${d.performedBy}.`,

      [NotificationType.EXPENSE_ADDED]: (d: any) =>
        `💰 New expense added: ${d.description || 'Expense'} - ${d.amount} ${d.currency || ''}.`,

      [NotificationType.SYSTEM_ALERT]: (d: SystemAlertData) => {
        const icon = d.alertType === 'error' ? '❌' : d.alertType === 'warning' ? '⚠️' : 'ℹ️';
        return `${icon} ${d.message}${d.details ? ` - ${d.details}` : ''}`;
      },

      [NotificationType.SYSTEM]: (d: any) =>
        d.message || 'System notification.',

      [NotificationType.CUSTOM]: (d: any) =>
        d.message || 'You have a new notification.',
    };

    const template = templates[type];
    if (!template) {
      return 'You have a new notification.';
    }

    try {
      return template(data);
    } catch (error) {
      console.error('Error generating notification template:', error);
      return 'You have a new notification.';
    }
  }

  /**
   * Generate notification title based on type
   */
  static generateTitle(type: NotificationType): string {
    const titles: Record<NotificationType, string> = {
      [NotificationType.LOW_STOCK]: 'Low Stock Alert',
      [NotificationType.OUT_OF_STOCK]: 'Out of Stock',
      [NotificationType.SALE_COMPLETED]: 'Sale Completed',
      [NotificationType.INVENTORY_UPDATED]: 'Inventory Updated',
      [NotificationType.STAFF_ACTION]: 'Staff Action',
      [NotificationType.STAFF_CREATED]: 'Staff Created',
      [NotificationType.STAFF_DELETED]: 'Staff Deleted',
      [NotificationType.EXPENSE_ADDED]: 'Expense Added',
      [NotificationType.SYSTEM_ALERT]: 'System Alert',
      [NotificationType.SYSTEM]: 'System Notification',
      [NotificationType.CUSTOM]: 'Notification',
    };

    return titles[type] || 'Notification';
  }

  /**
   * Get notification priority based on type
   */
  static getPriority(type: NotificationType): 'high' | 'medium' | 'low' {
    const priorities: Record<NotificationType, 'high' | 'medium' | 'low'> = {
      [NotificationType.OUT_OF_STOCK]: 'high',
      [NotificationType.LOW_STOCK]: 'high',
      [NotificationType.SYSTEM_ALERT]: 'high',
      [NotificationType.SYSTEM]: 'high',
      [NotificationType.SALE_COMPLETED]: 'medium',
      [NotificationType.INVENTORY_UPDATED]: 'medium',
      [NotificationType.STAFF_ACTION]: 'low',
      [NotificationType.STAFF_CREATED]: 'low',
      [NotificationType.STAFF_DELETED]: 'low',
      [NotificationType.EXPENSE_ADDED]: 'medium',
      [NotificationType.CUSTOM]: 'low',
    };

    return priorities[type] || 'low';
  }
}
