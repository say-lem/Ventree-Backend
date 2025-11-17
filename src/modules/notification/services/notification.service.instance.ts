import { NotificationService } from './notification.service';
import { getNotificationEmitter } from '../emitters/notification-emitter.instance';

/**
 * Singleton instance of NotificationService
 * Automatically wired with Redis emitter if available
 */
let notificationServiceInstance: NotificationService | null = null;

/**
 * Get or create the NotificationService singleton instance
 * The emitter is automatically set if Redis is available
 */
export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
    
    // Try to set the emitter (will be null if Redis is not available)
    try {
      const emitter = getNotificationEmitter();
      notificationServiceInstance.setEmitter(emitter);
    } catch (error) {
      console.warn('[NotificationService] Redis emitter not available, notifications will only be stored in database:', error);
    }
  }

  return notificationServiceInstance;
}








