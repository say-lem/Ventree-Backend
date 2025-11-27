import Redis from 'ioredis';
import { INotification } from '../models/notification.model';

/**
 * Notification Emitter
 * Handles real-time notification delivery via Redis pub/sub
 * Supports cross-instance broadcasting for horizontal scaling
 */
export class NotificationEmitter {
  private redisPublisher: Redis;
  private redisSubscriber: Redis;
  private subscriptions: Map<string, Set<(notification: INotification) => void>>;

  constructor(redisPublisher: Redis, redisSubscriber: Redis) {
    this.redisPublisher = redisPublisher;
    this.redisSubscriber = redisSubscriber;
    this.subscriptions = new Map();
    this.setupSubscriber();

    // Pattern subscriptions removed to prevent double delivery
    // WebSocket layer uses explicit subscriptions via subscribeToShop/subscribeToStaff/etc
  }

  /**
   * Setup Redis subscriber for incoming notifications
   * Only handles explicit subscriptions (not pattern subscriptions)
   */
  private setupSubscriber(): void {
    // Handle messages from explicit subscriptions
    this.redisSubscriber.on('message', (channel: string, message: string) => {
      try {
        const notification: INotification = JSON.parse(message);
        this.handleIncomingNotification(channel, notification);
      } catch (error) {
        console.error('[NotificationEmitter] Error parsing notification from Redis:', error);
      }
    });

    // Pattern subscriptions (pmessage) removed to prevent double delivery
    // All subscriptions are now explicit via subscribe() method
  }

  /**
   * Handle incoming notification from Redis
   */
  private handleIncomingNotification(channel: string, notification: INotification): void {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(notification);
        } catch (error) {
          console.error('[NotificationEmitter] Error in callback for channel', channel, ':', error);
        }
      });
    }
  }

  /**
   * Publish notification to shop channel
   * All users in the shop will receive this notification
   */
  async emitToShop(shopId: string, notification: INotification): Promise<void> {
    const channel = `notifications:shop:${shopId}`;
    const message = JSON.stringify(notification);

    try {
      await this.redisPublisher.publish(channel, message);
      console.log(`[NotificationEmitter] Published to shop channel: ${channel}`);
    } catch (error) {
      // Handle publish error with exponential backoff
      await this.retryPublish(channel, message, 3);
    }
  }

  /**
   * Publish notification to specific user
   * Only the target user will receive this notification
   */
  async emitToUser(userId: string, notification: INotification): Promise<void> {
    const channel = `notifications:user:${userId}`;
    const message = JSON.stringify(notification);

    try {
      await this.redisPublisher.publish(channel, message);
      console.log(`[NotificationEmitter] Published to user channel: ${channel}`);
    } catch (error) {
      // Handle publish error with exponential backoff
      await this.retryPublish(channel, message, 3);
    }
  }

  /**
   * Publish notification to staff member
   */
  async emitToStaff(shopId: string, staffId: string, notification: INotification): Promise<void> {
    const channel = `notifications:shop:${shopId}:staff:${staffId}`;
    const message = JSON.stringify(notification);

    try {
      await this.redisPublisher.publish(channel, message);
      console.log(`[NotificationEmitter] Published to staff channel: ${channel}`);
    } catch (error) {
      // Handle publish error with exponential backoff
      await this.retryPublish(channel, message, 3);
    }
  }

  /**
   * Publish notification to owner
   * Note: ownerProfileId should be 'owner' as per JWT auth contract
   */
  async emitToOwner(shopId: string, ownerProfileId: string, notification: INotification): Promise<void> {
    const channel = `notifications:shop:${shopId}:owner:${ownerProfileId}`;
    const message = JSON.stringify(notification);

    try {
      await this.redisPublisher.publish(channel, message);
      console.log(`[NotificationEmitter] Published to owner channel: ${channel}`);
    } catch (error) {
      // Handle publish error with exponential backoff
      await this.retryPublish(channel, message, 3);
    }
  }

  /**
   * Subscribe to shop notifications
   */
  async subscribeToShop(shopId: string, callback: (notification: INotification) => void): Promise<void> {
    const channel = `notifications:shop:${shopId}`;
    await this.subscribe(channel, callback);
  }

  /**
   * Subscribe to user notifications
   */
  async subscribeToUser(userId: string, callback: (notification: INotification) => void): Promise<void> {
    const channel = `notifications:user:${userId}`;
    await this.subscribe(channel, callback);
  }

  /**
   * Subscribe to staff notifications
   */
  async subscribeToStaff(
    shopId: string,
    staffId: string,
    callback: (notification: INotification) => void
  ): Promise<void> {
    const channel = `notifications:shop:${shopId}:staff:${staffId}`;
    await this.subscribe(channel, callback);
  }

  /**
   * Subscribe to owner notifications
   * Note: ownerProfileId should be 'owner' as per JWT auth contract
   */
  async subscribeToOwner(
    shopId: string,
    ownerProfileId: string,
    callback: (notification: INotification) => void
  ): Promise<void> {
    const channel = `notifications:shop:${shopId}:owner:${ownerProfileId}`;
    await this.subscribe(channel, callback);
  }

  /**
   * Generic subscribe method
   */
  private async subscribe(channel: string, callback: (notification: INotification) => void): Promise<void> {
    // Add callback to subscriptions map
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      // Subscribe to Redis channel
      await this.redisSubscriber.subscribe(channel);
    }

    this.subscriptions.get(channel)!.add(callback);
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel: string, callback?: (notification: INotification) => void): Promise<void> {
    const callbacks = this.subscriptions.get(channel);

    if (!callbacks) {
      return;
    }

    if (callback) {
      callbacks.delete(callback);
    }

    // If no more callbacks, unsubscribe from Redis
    if (callbacks.size === 0 || !callback) {
      this.subscriptions.delete(channel);
      await this.redisSubscriber.unsubscribe(channel);
    }
  }

  /**
   * Retry publish with exponential backoff
   */
  private async retryPublish(channel: string, message: string, maxRetries: number): Promise<void> {
    let retries = 0;
    let delay = 1000; // Start with 1 second

    while (retries < maxRetries) {
      try {
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.redisPublisher.publish(channel, message);
        return;
      } catch (error) {
        retries++;
        delay *= 2; // Exponential backoff
        if (retries >= maxRetries) {
          console.error(`[NotificationEmitter] Failed to publish to ${channel} after ${maxRetries} retries:`, error);
        }
      }
    }
  }

  /**
   * Close all subscriptions and connections
   */
  async close(): Promise<void> {
    for (const channel of this.subscriptions.keys()) {
      await this.redisSubscriber.unsubscribe(channel);
    }
    this.subscriptions.clear();
  }
}
