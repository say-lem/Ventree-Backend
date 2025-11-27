/**
 * Notification Module Entry Point
 * Exports all public interfaces and components
 */

// Main route
export { default as notificationRoutes } from './routes/notification.routes';

// Services
export { NotificationService } from './services/notification.service';
export { NotificationSettingsService } from './services/notification-settings.service';

// Repositories
export { NotificationRepository } from './repositories/notification.repository';
export { NotificationSettingsRepository } from './repositories/notification-settings.repository';

// Models
export { NotificationModel, INotification } from './models/notification.model';
export { NotificationSettingsModel, INotificationSettings } from './models/notification-settings.model';

// Types
export * from './types/notification-types';

// Utilities
export { VectorClockUtil, VectorClock } from './utils/vector-clock.util';
export { NotificationTemplateUtil } from './utils/notification-template.util';

// Auth types (re-export from shared middleware)
export { TokenPayload, AuthenticatedRequest } from '../../shared/middleware/auth.middleware';

// Emitter and WebSocket
export { NotificationEmitter } from './emitters/notification.emitter';
export { NotificationSocketIOHandler } from './websockets/notification-socketio';

// Auto Triggers
export { AutoNotificationTriggers } from './triggers/auto-notifications';

// Controllers
export { NotificationController } from './controllers/notification.controller';
export { NotificationSettingsController } from './controllers/notification-settings.controller';

// DTOs
export * from './dto/create-notification.dto';
export * from './dto/query-notifications.dto';
export * from './dto/mark-read.dto';
export * from './dto/notification-settings.dto';
