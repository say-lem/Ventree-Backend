import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Redis Configuration
 * Creates and manages Redis connections for pub/sub messaging
 */
class RedisConfig {
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;

  /**
   * Get Redis publisher client
   * Used for publishing notifications to channels
   */
  getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.publisher.on('connect', () => {
        console.log('✅ Redis Publisher connected');
      });

      this.publisher.on('error', (err) => {
        console.error('❌ Redis Publisher error:', err);
      });

      this.publisher.on('close', () => {
        console.log('⚠️ Redis Publisher connection closed');
      });
    }

    return this.publisher;
  }

  /**
   * Get Redis subscriber client
   * Used for subscribing to notification channels
   */
  getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.subscriber.on('connect', () => {
        console.log('✅ Redis Subscriber connected');
      });

      this.subscriber.on('error', (err) => {
        console.error('❌ Redis Subscriber error:', err);
      });

      this.subscriber.on('close', () => {
        console.log('⚠️ Redis Subscriber connection closed');
      });
    }

    return this.subscriber;
  }

  /**
   * Test Redis connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const testClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
      });

      await testClient.ping();
      await testClient.quit();
      return true;
    } catch (error) {
      console.error('Redis connection test failed:', error);
      return false;
    }
  }

  /**
   * Close all Redis connections
   */
  async closeConnections(): Promise<void> {
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }

    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}

// Export singleton instance
export const redisConfig = new RedisConfig();








