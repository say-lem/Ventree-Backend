import { body, query, ValidationChain } from 'express-validator';

/**
 * Update Notification Settings DTO
 */
export interface UpdateNotificationSettingsDto {
  shopId: string;
  lowStockEnabled?: boolean;
  outOfStockEnabled?: boolean;
  saleCompletedEnabled?: boolean;
}

/**
 * Get Notification Settings DTO
 */
export interface GetNotificationSettingsDto {
  shopId: string;
}

/**
 * Validation for updating notification settings
 * PATCH /api/v1/notifications/settings
 */
export const updateSettingsValidation: ValidationChain[] = [
  body('shopId')
    .notEmpty()
    .withMessage('Shop ID is required')
    .isMongoId()
    .withMessage('Shop ID must be a valid MongoDB ObjectId'),

  body('lowStockEnabled')
    .optional()
    .isBoolean()
    .withMessage('lowStockEnabled must be a boolean'),

  body('outOfStockEnabled')
    .optional()
    .isBoolean()
    .withMessage('outOfStockEnabled must be a boolean'),

  body('saleCompletedEnabled')
    .optional()
    .isBoolean()
    .withMessage('saleCompletedEnabled must be a boolean'),
];

/**
 * Validation for getting notification settings
 * GET /api/v1/notifications/settings
 */
export const getSettingsValidation: ValidationChain[] = [
  query('shopId')
    .notEmpty()
    .withMessage('Shop ID is required')
    .isMongoId()
    .withMessage('Shop ID must be a valid MongoDB ObjectId'),
];

