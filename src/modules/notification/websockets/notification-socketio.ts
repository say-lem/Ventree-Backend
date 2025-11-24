import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { INotification } from '../models/notification.model';
import { getNotificationEmitter } from '../emitters/notification-emitter.instance';
import { TokenPayload } from '../../../shared/middleware/auth.middleware';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in environment variables');
}

/**
 * Socket.IO Connection Info
 */
interface SocketConnection {
  socketId: string;
  userId: string;
  shopId: string;
  role: 'owner' | 'staff';
  profileId: string;
}

/**
 * Notification Socket.IO Handler
 * Manages Socket.IO connections and broadcasts notifications from Redis
 */
export class NotificationSocketIOHandler {
  private io: SocketIOServer;
  private connections: Map<string, SocketConnection>;
  private userConnections: Map<string, Set<string>>; // userId -> Set of socket IDs
  private shopConnections: Map<string, Set<string>>; // shopId -> Set of socket IDs
  private shopSubscriptions: Map<
    string,
    {
      shopCallback: (notification: INotification) => void;
      ownerCallback: (notification: INotification) => void;
    }
  >;
  private staffSubscriptions: Map<
    string,
    {
      callback: (notification: INotification) => void;
      refCount: number;
    }
  >;

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*', // Configure this for production
        methods: ['GET', 'POST'],
      },
      path: '/socket.io/notifications',
    });

    this.connections = new Map();
    this.userConnections = new Map();
    this.shopConnections = new Map();
    this.shopSubscriptions = new Map();
    this.staffSubscriptions = new Map();

    this.setupSocketHandlers();
    this.setupRedisSubscriptions();
  }

  /**
   * Setup Socket.IO connection handlers
   */
  private setupSocketHandlers(): void {
    this.io.use((socket, next) => {
      // Authenticate socket connection using JWT token
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      if (!JWT_SECRET) {
        return next(new Error('JWT_SECRET not configured'));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Type assertion after verification
        const payload = decoded as unknown as TokenPayload;
        (socket as any).user = payload;
        next();
      } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
          return next(new Error('Token has expired'));
        }
        if (error.name === 'JsonWebTokenError') {
          return next(new Error('Invalid token'));
        }
        return next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      const user = (socket as any).user as TokenPayload;
      const connectionId = socket.id;

      console.log(`[SocketIO] Client connected: ${connectionId} (User: ${user.id}, Shop: ${user.shopId}, Role: ${user.role})`);

      // Register connection
      const connection: SocketConnection = {
        socketId: connectionId,
        userId: user.id,
        shopId: user.shopId,
        role: user.role,
        profileId: user.profileId,
      };

      this.connections.set(connectionId, connection);

      // Track user connections
      if (!this.userConnections.has(user.id)) {
        this.userConnections.set(user.id, new Set());
      }
      this.userConnections.get(user.id)!.add(connectionId);

      // Track shop connections
      if (!this.shopConnections.has(user.shopId)) {
        this.shopConnections.set(user.shopId, new Set());
        // Subscribe to shop notifications when first client connects
        this.subscribeToShopNotifications(user.shopId).catch((error) => {
          console.error(`[SocketIO] Failed to subscribe to shop ${user.shopId}:`, error);
        });
      }
      this.shopConnections.get(user.shopId)!.add(connectionId);

      if (user.role === 'staff') {
        this.subscribeToStaffNotifications(user.shopId, user.profileId).catch((error) => {
          console.error(
            `[SocketIO] Failed to subscribe staff ${user.profileId} to shop ${user.shopId}:`,
            error
          );
        });
      }

      // Send connection confirmation
      socket.emit('connected', {
        message: 'Connected to notification server',
        userId: user.id,
        shopId: user.shopId,
        role: user.role,
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`[SocketIO] Client disconnected: ${connectionId}`);
        this.handleDisconnect(connectionId);
      });

      // Handle ping/pong for keepalive
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  /**
   * Setup Redis subscriptions to forward notifications to Socket.IO clients
   * Uses the emitter's internal subscription mechanism
   */
  private setupRedisSubscriptions(): void {
    const emitter = getNotificationEmitter();

    // Subscribe to shop channel pattern - notifications will come via pmessage
    // The emitter already has pattern subscriptions set up, we just need to listen
    // We'll use a different approach - subscribe to specific channels as shops connect
    
    // For now, we'll handle notifications when they're published
    // The emitter's pmessage handler will call our callbacks
    // We need to register callbacks for each shop as clients connect
    
    console.log('[SocketIO] Redis subscriptions will be set up per shop as clients connect');
  }

  /**
   * Subscribe to notifications for a specific shop
   * Called when first client from a shop connects
   */
  private async subscribeToShopNotifications(shopId: string): Promise<void> {
    if (this.shopSubscriptions.has(shopId)) {
      return;
    }

    const emitter = getNotificationEmitter();
    const shopCallback = (notification: INotification) => {
      this.broadcastToShop(shopId, notification);
    };
    const ownerCallback = (notification: INotification) => {
      this.sendToOwner(shopId, 'owner', notification);
    };

    await emitter.subscribeToShop(shopId, shopCallback);
    await emitter.subscribeToOwner(shopId, 'owner', ownerCallback);

    this.shopSubscriptions.set(shopId, { shopCallback, ownerCallback });

    console.log(`[SocketIO] Subscribed to notifications for shop ${shopId}`);
  }

  /**
   * Unsubscribe from all channels for a shop when no clients remain
   */
  private async unsubscribeFromShop(shopId: string): Promise<void> {
    const subscription = this.shopSubscriptions.get(shopId);
    if (!subscription) {
      return;
    }

    const emitter = getNotificationEmitter();
    try {
      await emitter.unsubscribe(`notifications:shop:${shopId}`, subscription.shopCallback);
      await emitter.unsubscribe(
        `notifications:shop:${shopId}:owner:owner`,
        subscription.ownerCallback
      );
      console.log(`[SocketIO] Unsubscribed from notifications for shop ${shopId}`);
    } catch (error) {
      console.error(`[SocketIO] Failed to unsubscribe from shop ${shopId}:`, error);
    } finally {
      this.shopSubscriptions.delete(shopId);
    }
  }

  /**
   * Broadcast notification to all clients in a shop
   * 
   * @param shopId - Shop ID
   * @param notification - Notification to broadcast
   * @param excludeOwner - If true, excludes owner from broadcast (to prevent double-delivery)
   */
  private broadcastToShop(shopId: string, notification: INotification, excludeOwner: boolean = false): void {
    const connectionIds = this.shopConnections.get(shopId);

    if (!connectionIds || connectionIds.size === 0) {
      return;
    }

    const message = {
      type: 'notification',
      data: notification,
    };

    let sentCount = 0;
    connectionIds.forEach((socketId) => {
      const connection = this.connections.get(socketId);
      
      // Skip owner if excludeOwner flag is set (prevents double-delivery)
      if (excludeOwner && connection && connection.role === 'owner') {
        return;
      }

      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('notification', message);
        sentCount++;
      }
    });

    console.log(`[SocketIO] Broadcasted notification to ${sentCount} client(s) in shop ${shopId}${excludeOwner ? ' (owner excluded)' : ''}`);
  }

  /**
   * Send notification to shop owner
   */
  private sendToOwner(shopId: string, ownerProfileId: string, notification: INotification): void {
    const connectionIds = this.shopConnections.get(shopId);

    if (!connectionIds || connectionIds.size === 0) {
      return;
    }

    const message = {
      type: 'notification',
      data: notification,
    };

    let sentCount = 0;
    connectionIds.forEach((socketId) => {
      const connection = this.connections.get(socketId);
      if (connection && connection.role === 'owner' && connection.profileId === ownerProfileId) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('notification', message);
          sentCount++;
        }
      }
    });

    if (sentCount > 0) {
      console.log(`[SocketIO] Sent notification to ${sentCount} owner client(s) in shop ${shopId}`);
    }
  }

  /**
   * Send notification to specific staff member
   */
  private sendToStaff(shopId: string, staffId: string, notification: INotification): void {
    const connectionIds = this.shopConnections.get(shopId);

    if (!connectionIds || connectionIds.size === 0) {
      return;
    }

    const message = {
      type: 'notification',
      data: notification,
    };

    let sentCount = 0;
    connectionIds.forEach((socketId) => {
      const connection = this.connections.get(socketId);
      if (
        connection &&
        connection.role === 'staff' &&
        connection.profileId === staffId
      ) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('notification', message);
          sentCount++;
        }
      }
    });

    if (sentCount > 0) {
      console.log(`[SocketIO] Sent notification to ${sentCount} staff client(s) in shop ${shopId}`);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnect(socketId: string): void {
    const connection = this.connections.get(socketId);

    if (!connection) {
      return;
    }

    // Remove from user connections
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(socketId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

      // Remove from shop connections
      const shopConnections = this.shopConnections.get(connection.shopId);
      if (shopConnections) {
        shopConnections.delete(socketId);
        if (shopConnections.size === 0) {
          this.shopConnections.delete(connection.shopId);
          void this.unsubscribeFromShop(connection.shopId);
        }
      }

    // Remove connection
    this.connections.delete(socketId);

    if (connection.role === 'staff') {
      void this.unsubscribeFromStaffNotifications(connection.shopId, connection.profileId);
    }
  }

  /**
   * Get active connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get active connections for a shop
   */
  getShopConnectionCount(shopId: string): number {
    const connections = this.shopConnections.get(shopId);
    return connections ? connections.size : 0;
  }

  /**
   * Get active connections for a user
   */
  getUserConnectionCount(userId: string): number {
    const connections = this.userConnections.get(userId);
    return connections ? connections.size : 0;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    this.io.close();

    const emitter = getNotificationEmitter();

    for (const [shopId, subscription] of this.shopSubscriptions.entries()) {
      try {
        await emitter.unsubscribe(`notifications:shop:${shopId}`, subscription.shopCallback);
        await emitter.unsubscribe(
          `notifications:shop:${shopId}:owner:owner`,
          subscription.ownerCallback
        );
      } catch (error) {
        console.error(`[SocketIO] Error unsubscribing shop ${shopId} on close:`, error);
      }
    }

    for (const [key, subscription] of this.staffSubscriptions.entries()) {
      const [shopId, staffId] = key.split(':');
      if (!shopId || !staffId) {
        continue;
      }
      try {
        await emitter.unsubscribe(
          `notifications:shop:${shopId}:staff:${staffId}`,
          subscription.callback
        );
      } catch (error) {
        console.error(
          `[SocketIO] Error unsubscribing staff ${staffId} in shop ${shopId} on close:`,
          error
        );
      }
    }

    this.connections.clear();
    this.userConnections.clear();
    this.shopConnections.clear();
    this.shopSubscriptions.clear();
    this.staffSubscriptions.clear();
  }

  /**
   * Subscribe to staff-specific notifications so targeted messages reach active sockets
   */
  private async subscribeToStaffNotifications(shopId: string, staffId: string): Promise<void> {
    const key = this.getStaffSubscriptionKey(shopId, staffId);
    const existing = this.staffSubscriptions.get(key);

    if (existing) {
      existing.refCount += 1;
      return;
    }

    const emitter = getNotificationEmitter();
    const callback = (notification: INotification) => {
      this.sendToStaff(shopId, staffId, notification);
    };

    await emitter.subscribeToStaff(shopId, staffId, callback);
    this.staffSubscriptions.set(key, { callback, refCount: 1 });
    console.log(`[SocketIO] Subscribed to staff notifications for shop ${shopId}, staff ${staffId}`);
  }

  /**
   * Remove staff-specific subscription when no connections remain
   */
  private async unsubscribeFromStaffNotifications(shopId: string, staffId: string): Promise<void> {
    const key = this.getStaffSubscriptionKey(shopId, staffId);
    const subscription = this.staffSubscriptions.get(key);

    if (!subscription) {
      return;
    }

    subscription.refCount -= 1;
    if (subscription.refCount > 0) {
      return;
    }

    this.staffSubscriptions.delete(key);

    const emitter = getNotificationEmitter();
    try {
      await emitter.unsubscribe(
        `notifications:shop:${shopId}:staff:${staffId}`,
        subscription.callback
      );
      console.log(
        `[SocketIO] Unsubscribed from staff notifications for shop ${shopId}, staff ${staffId}`
      );
    } catch (error) {
      console.error(
        `[SocketIO] Failed to unsubscribe staff ${staffId} in shop ${shopId}:`,
        error
      );
    }
  }

  private getStaffSubscriptionKey(shopId: string, staffId: string): string {
    return `${shopId}:${staffId}`;
  }
}

