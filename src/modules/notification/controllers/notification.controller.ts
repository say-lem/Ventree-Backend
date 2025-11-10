import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { NotificationService } from '../services/notification.service';
import { NotificationType } from '../types/notification-types';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ValidationError } from '../../../shared/utils/AppError';

/**
 * Notification Controller
 * Handles HTTP requests for notification operations
 */
export class NotificationController {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Create a new notification
   * POST /api/v1/notifications
   */
  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { shopId, recipientType, recipientId, message, type, inventoryId, metadata } = req.body;

    const notification = await this.notificationService.createNotification({
      shopId,
      recipientType,
      recipientId,
      message,
      type: type as NotificationType,
      inventoryId,
      metadata,
      authContext: req.user!,
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  });

  /**
   * Get all notifications for the authenticated user
   * GET /api/v1/notifications
   */
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { shopId, unreadOnly, limit, offset, fromDate, toDate, type } = req.query;

    const result = await this.notificationService.getNotifications({
      shopId: parseInt(shopId as string),
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      type: type as string,
      authContext: req.user!,
    });

    res.status(200).json({
      success: true,
      data: result.notifications,
      pagination: {
        total: result.total,
        page: result.page,
        pages: result.pages,
        limit: limit ? parseInt(limit as string) : 20,
      },
    });
  });

  /**
   * Get notification by ID
   * GET /api/v1/notifications/:id
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const notification = await this.notificationService.getNotificationById(id, req.user!);

    res.status(200).json({
      success: true,
      data: notification,
    });
  });

  /**
   * Get unread notification count
   * GET /api/v1/notifications/unread-count
   */
  getUnreadCount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { shopId } = req.query;

    const count = await this.notificationService.getUnreadCount(
      parseInt(shopId as string),
      req.user!
    );

    res.status(200).json({
      success: true,
      data: { count },
    });
  });

  /**
   * Mark notification as read
   * PATCH /api/v1/notifications/:id/read
   */
  markAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const notification = await this.notificationService.markAsRead(id, req.user!);

    res.status(200).json({
      success: true,
      data: notification,
    });
  });

  /**
   * Bulk mark notifications as read
   * PATCH /api/v1/notifications/mark-read
   */
  bulkMarkAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { notificationIds } = req.body;

    const count = await this.notificationService.bulkMarkAsRead({
      notificationIds,
      authContext: req.user!,
    });

    res.status(200).json({
      success: true,
      data: { count },
      message: `${count} notification(s) marked as read`,
    });
  });

  /**
   * Delete notification
   * DELETE /api/v1/notifications/:id
   */
  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    await this.notificationService.deleteNotification(id, req.user!);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  });
}
