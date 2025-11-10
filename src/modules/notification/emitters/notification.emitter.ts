import { INotification } from '../schemas/notification.schema';

/**
 * Redis Client Interface (mock for now)
 * Will be replaced with actual Redis client when available
 */
export interface RedisClient {
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string): Promise<void>;
  on(event: string, callback: (...args: any[]) => void): void;
  unsubscribe(channel?: string): Promise<void>;
}

/**
 * Notification Emitter
 * Handles real-time notification delivery via Redis pub/sub
 * Supports cross-instance broadcasting for horizontal scaling
 */
export class NotificationEmitter {
  private redisPublisher: RedisClient;
  private redisSubscriber: RedisClient;
  private subscriptions: Map<string, Set<(notification: INotification) => void>>;

  constructor(redisPublisher: RedisClient, redisSubscriber: RedisClient) {
    this.redisPublisher = redisPublisher;
    this.redisSubscriber = redisSubscriber;
    this.subscriptions = new Map();
    this.setupSubscriber();
  }

  /**
   * Setup Redis subscriber for incoming notifications
   */
  private setupSubscriber(): void {
    this.redisSubscriber.on('message', (channel: string, message: string) => {
      try {
        const notification: INotification = JSON.parse(message);
        this.handleIncomingNotification(channel, notification);
      } catch (error) {
        // Error parsing notification
      }
    });
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
          // Error in callback
        }
      });
    }
  }

  /**
   * Publish notification to shop channel
   * All users in the shop will receive this notification
   */
  async emitToShop(shopId: number, notification: INotification): Promise<void> {
    const channel = `notifications:shop:${shopId}`;
    const message = JSON.stringify(notification);

    try {
      await this.redisPublisher.publish(channel, message);
    } catch (error) {
      // Handle publish error with exponential backoff
      await this.retryPublish(channel, message, 3);
    }
  }

  /**
   * Publish notification to specific user
   * Only the target user will receive this notification
   */
  async emitToUser(userId: number, notification: INotification): Promise<void> {
    const channel = `notifications:user:${userId}`;
    const message = JSON.stringify(notification);

    try {
      await this.redisPublisher.publish(channel, message);
    } catch (error) {
      // Handle publish error with exponential backoff
      await this.retryPublish(channel, message, 3);
    }
  }

  /**
   * Publish notification to staff member
   */
  async emitToStaff(shopId: number, staffId: number, notification: INotification): Promise<void> {
    const channel = `notifications:shop:${shopId}:staff:${staffId}`;
    const message = JSON.stringify(notification);

    try {
      await this.redisPublisher.publish(channel, message);
    } catch (error) {
      // Handle publish error with exponential backoff
      await this.retryPublish(channel, message, 3);
    }
  }

  /**
   * Publish notification to owner
   */
  async emitToOwner(shopId: number, ownerProfileId: number, notification: INotification): Promise<void> {
    const channel = `notifications:shop:${shopId}:owner:${ownerProfileId}`;
    const message = JSON.stringify(notification);

    try {
      await this.redisPublisher.publish(channel, message);
    } catch (error) {
      // Handle publish error with exponential backoff
      await this.retryPublish(channel, message, 3);
    }
  }

  /**
   * Subscribe to shop notifications
   */
  async subscribeToShop(shopId: number, callback: (notification: INotification) => void): Promise<void> {
    const channel = `notifications:shop:${shopId}`;
    await this.subscribe(channel, callback);
  }

  /**
   * Subscribe to user notifications
   */
  async subscribeToUser(userId: number, callback: (notification: INotification) => void): Promise<void> {
    const channel = `notifications:user:${userId}`;
    await this.subscribe(channel, callback);
  }

  /**
   * Subscribe to staff notifications
   */
  async subscribeToStaff(
    shopId: number,
    staffId: number,
    callback: (notification: INotification) => void
  ): Promise<void> {
    const channel = `notifications:shop:${shopId}:staff:${staffId}`;
    await this.subscribe(channel, callback);
  }

  /**
   * Subscribe to owner notifications
   */
  async subscribeToOwner(
    shopId: number,
    ownerProfileId: number,
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
      }
    }

    // Max retries reached, log error
    // TODO: Add proper logging
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
