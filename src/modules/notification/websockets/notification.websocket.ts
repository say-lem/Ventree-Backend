import { INotification } from '../models/notification.model';

/**
 * WebSocket Interface (stub for now)
 * Will be replaced with actual WebSocket implementation when available
 */
export interface WebSocket {
  send(data: string): void;
  close(): void;
  readyState: number;
}

/**
 * WebSocket Connection Info
 */
interface ConnectionInfo {
  ws: WebSocket;
  userId: string;
  shopId: string;
  role: 'owner' | 'staff';
  profileId: string;
}

/**
 * Notification WebSocket Handler
 * Manages WebSocket connections and broadcasts notifications to connected clients
 * This is a stub implementation that will be integrated with the API Gateway
 */
export class NotificationWebSocketHandler {
  private connections: Map<string, ConnectionInfo>;
  private userConnections: Map<string, Set<string>>; // userId -> Set of connection IDs
  private shopConnections: Map<string, Set<string>>; // shopId -> Set of connection IDs

  constructor() {
    this.connections = new Map();
    this.userConnections = new Map();
    this.shopConnections = new Map();
  }

  /**
   * Register a new WebSocket connection
   */
  registerConnection(
    connectionId: string,
    ws: WebSocket,
    userId: string,
    shopId: string,
    role: 'owner' | 'staff',
    profileId: string
  ): void {
    const connectionInfo: ConnectionInfo = {
      ws,
      userId,
      shopId,
      role,
      profileId,
    };

    this.connections.set(connectionId, connectionInfo);

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // Track shop connections
    if (!this.shopConnections.has(shopId)) {
      this.shopConnections.set(shopId, new Set());
    }
    this.shopConnections.get(shopId)!.add(connectionId);
  }

  /**
   * Send notification to a specific client
   */
  sendToClient(userId: string, notification: INotification): void {
    const connectionIds = this.userConnections.get(userId);

    if (!connectionIds) {
      return;
    }

    const message = JSON.stringify({
      type: 'notification',
      data: notification,
    });

    connectionIds.forEach((connectionId) => {
      const connection = this.connections.get(connectionId);
      if (connection && this.isConnectionOpen(connection.ws)) {
        try {
          connection.ws.send(message);
        } catch (error) {
          // Handle send error
          this.handleDisconnect(connectionId);
        }
      }
    });
  }

  /**
   * Broadcast notification to all clients in a shop
   */
  broadcastToShop(shopId: string, notification: INotification): void {
    const connectionIds = this.shopConnections.get(shopId);

    if (!connectionIds) {
      return;
    }

    const message = JSON.stringify({
      type: 'notification',
      data: notification,
    });

    connectionIds.forEach((connectionId) => {
      const connection = this.connections.get(connectionId);
      if (connection && this.isConnectionOpen(connection.ws)) {
        try {
          connection.ws.send(message);
        } catch (error) {
          // Handle send error
          this.handleDisconnect(connectionId);
        }
      }
    });
  }

  /**
   * Send notification to specific staff member
   */
  sendToStaff(shopId: string, staffId: string, notification: INotification): void {
    const connectionIds = this.shopConnections.get(shopId);

    if (!connectionIds) {
      return;
    }

    const message = JSON.stringify({
      type: 'notification',
      data: notification,
    });

    connectionIds.forEach((connectionId) => {
      const connection = this.connections.get(connectionId);
      if (
        connection &&
        connection.role === 'staff' &&
        connection.profileId === staffId &&
        this.isConnectionOpen(connection.ws)
      ) {
        try {
          connection.ws.send(message);
        } catch (error) {
          // Handle send error
          this.handleDisconnect(connectionId);
        }
      }
    });
  }

  /**
   * Send notification to shop owner
   */
  sendToOwner(shopId: string, ownerProfileId: string, notification: INotification): void {
    const connectionIds = this.shopConnections.get(shopId);

    if (!connectionIds) {
      return;
    }

    const message = JSON.stringify({
      type: 'notification',
      data: notification,
    });

    connectionIds.forEach((connectionId) => {
      const connection = this.connections.get(connectionId);
      if (
        connection &&
        connection.role === 'owner' &&
        connection.profileId === ownerProfileId &&
        this.isConnectionOpen(connection.ws)
      ) {
        try {
          connection.ws.send(message);
        } catch (error) {
          // Handle send error
          this.handleDisconnect(connectionId);
        }
      }
    });
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      return;
    }

    // Remove from user connections
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Remove from shop connections
    const shopConnections = this.shopConnections.get(connection.shopId);
    if (shopConnections) {
      shopConnections.delete(connectionId);
      if (shopConnections.size === 0) {
        this.shopConnections.delete(connection.shopId);
      }
    }

    // Remove connection
    this.connections.delete(connectionId);

    // Close WebSocket if still open
    if (this.isConnectionOpen(connection.ws)) {
      connection.ws.close();
    }
  }

  /**
   * Check if WebSocket connection is open
   */
  private isConnectionOpen(ws: WebSocket): boolean {
    // WebSocket.OPEN = 1
    return ws.readyState === 1;
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
  closeAll(): void {
    this.connections.forEach((connection, connectionId) => {
      this.handleDisconnect(connectionId);
    });
  }
}
