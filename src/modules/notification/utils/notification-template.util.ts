import {
  NotificationType,
  LowStockData,
  OutOfStockData,
  SaleCompletedData,
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
      [NotificationType.SALE_COMPLETED]: 'medium',
    };

    return priorities[type] || 'low';
  }
}
