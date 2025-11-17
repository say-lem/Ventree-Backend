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

// Models
export { NotificationModel, INotification } from './models/notification.model';

// Types
export * from './types/notification-types';

// Utilities
export { VectorClockUtil, VectorClock } from './utils/vector-clock.util';
export { NotificationTemplateUtil } from './utils/notification-template.util';

// Auth types (re-export from shared middleware)
export { TokenPayload, AuthenticatedRequest } from '../../shared/middleware/auth.middleware';

// Emitter and WebSocket
export { NotificationEmitter } from './emitters/notification.emitter';
export { NotificationWebSocketHandler, WebSocket } from './websockets/notification.websocket';

// Auto Triggers
export { AutoNotificationTriggers } from './triggers/auto-notifications';

// DTOs
export * from './dto/create-notification.dto';
export * from './dto/query-notifications.dto';
export * from './dto/mark-read.dto';
