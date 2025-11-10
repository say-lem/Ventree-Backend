/**
 * Notification Module Entry Point
 * Exports all public interfaces and components
 */

// Main route
export { default as notificationRoutes } from './routes/notification.routes';

// Service
export { NotificationService } from './services/notification.service';

// Repository
export { NotificationRepository } from './repositories/notification.repository';

// Schemas and Models
export { NotificationModel, INotification } from './schemas/notification.schema';

// Types
export * from './types/notification-types';

// Utilities
export { VectorClockUtil, VectorClock } from './utils/vector-clock.util';
export { NotificationTemplateUtil } from './utils/notification-template.util';

// Interfaces
export * from './interfaces/mock-auth.interface';
export * from './interfaces/mock-services.interface';

// Emitter and WebSocket
export { NotificationEmitter, RedisClient } from './emitters/notification.emitter';
export { NotificationWebSocketHandler, WebSocket } from './websockets/notification.websocket';

// Auto Triggers
export { AutoNotificationTriggers } from './triggers/auto-notifications';

// DTOs
export * from './dto/create-notification.dto';
export * from './dto/query-notifications.dto';
export * from './dto/mark-read.dto';
