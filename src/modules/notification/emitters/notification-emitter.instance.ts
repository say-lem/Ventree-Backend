import { NotificationEmitter } from './notification.emitter';
import { redisConfig } from '../../../shared/config/redis.config';

/**
 * Singleton instance of NotificationEmitter
 * Initialized with Redis connections from redisConfig
 */
let notificationEmitterInstance: NotificationEmitter | null = null;

/**
 * Get or create the NotificationEmitter singleton instance
 */
export function getNotificationEmitter(): NotificationEmitter {
  if (!notificationEmitterInstance) {
    const publisher = redisConfig.getPublisher();
    const subscriber = redisConfig.getSubscriber();
    notificationEmitterInstance = new NotificationEmitter(publisher, subscriber);
  }

  return notificationEmitterInstance;
}

/**
 * Close the NotificationEmitter instance and Redis connections
 */
export async function closeNotificationEmitter(): Promise<void> {
  if (notificationEmitterInstance) {
    await notificationEmitterInstance.close();
    notificationEmitterInstance = null;
  }
  await redisConfig.closeConnections();
}

