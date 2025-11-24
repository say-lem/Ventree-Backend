import { Response } from 'express';
import { validationResult } from 'express-validator';
import { NotificationSettingsService } from '../services/notification-settings.service';
import { AuthenticatedRequest } from '../../../shared/middleware/auth.middleware';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ValidationError } from '../../../shared/utils/AppError';

/**
 * Notification Settings Controller
 * Handles HTTP requests for notification settings management
 */
export class NotificationSettingsController {
  private settingsService: NotificationSettingsService;

  constructor(settingsService?: NotificationSettingsService) {
    this.settingsService = settingsService || new NotificationSettingsService();
  }

  /**
   * Get notification settings
   * GET /api/v1/notifications/settings
   */
  getSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { shopId } = req.query;

    const settings = await this.settingsService.getSettings(shopId as string, req.user!);

    res.status(200).json({
      success: true,
      data: settings,
    });
  });

  /**
   * Update notification settings
   * PATCH /api/v1/notifications/settings
   */
  updateSettings = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { shopId, lowStockEnabled, outOfStockEnabled, saleCompletedEnabled } = req.body;

      const settings = await this.settingsService.updateSettings({
        shopId,
        lowStockEnabled,
        outOfStockEnabled,
        saleCompletedEnabled,
        authContext: req.user!,
      });

      res.status(200).json({
        success: true,
        message: 'Notification settings updated successfully',
        data: settings,
      });
    }
  );
}

