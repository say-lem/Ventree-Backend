import { query } from 'express-validator';

/**
 * Query Notifications Validation
 */
export const queryNotificationsValidation = [
  query('shopId')
    .notEmpty()
    .withMessage('Shop ID is required')
    .isMongoId()
    .withMessage('Shop ID must be a valid MongoDB ObjectId'),

  query('unreadOnly')
    .optional()
    .isBoolean()
    .withMessage('unreadOnly must be a boolean'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),

  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('fromDate must be a valid ISO 8601 date'),

  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('toDate must be a valid ISO 8601 date'),

  query('type')
    .optional()
    .isIn([
      'low_stock',
      'out_of_stock',
      'sale_completed',
    ])
    .withMessage('Invalid notification type'),
];

/**
 * Query Notifications Query Parameters Interface
 */
export interface QueryNotificationsDto {
  shopId: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  fromDate?: string;
  toDate?: string;
  type?: string;
}
