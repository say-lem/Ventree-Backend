import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { checkNotificationPermission } from '../middleware/check-permissions.middleware';
import { createNotificationValidation } from '../dto/create-notification.dto';
import { queryNotificationsValidation } from '../dto/query-notifications.dto';
import { markReadValidation } from '../dto/mark-read.dto';
import { query } from 'express-validator';

const router = Router();
const notificationController = new NotificationController();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/notifications
 * Create a new notification
 * Requires: notification permissions
 */
router.post(
  '/',
  checkNotificationPermission,
  createNotificationValidation,
  notificationController.create
);

/**
 * GET /api/v1/notifications
 * Get all notifications for the authenticated user
 * Query params: shopId, unreadOnly, limit, offset, fromDate, toDate, type
 */
router.get(
  '/',
  queryNotificationsValidation,
  notificationController.getAll
);

/**
 * GET /api/v1/notifications/unread-count
 * Get unread notification count
 * Query params: shopId
 */
router.get(
  '/unread-count',
  [
    query('shopId')
      .notEmpty()
      .withMessage('Shop ID is required')
      .isInt({ min: 1 })
      .withMessage('Shop ID must be a positive integer'),
  ],
  notificationController.getUnreadCount
);

/**
 * GET /api/v1/notifications/:id
 * Get notification by ID
 */
router.get(
  '/:id',
  notificationController.getById
);

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark notification as read
 */
router.patch(
  '/:id/read',
  notificationController.markAsRead
);

/**
 * PATCH /api/v1/notifications/mark-read
 * Bulk mark notifications as read
 */
router.patch(
  '/mark-read',
  markReadValidation,
  notificationController.bulkMarkAsRead
);

/**
 * DELETE /api/v1/notifications/:id
 * Delete notification
 */
router.delete(
  '/:id',
  notificationController.delete
);

export default router;
