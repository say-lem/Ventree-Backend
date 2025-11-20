import { body } from 'express-validator';
import { Types } from 'mongoose';

/**
 * Create Notification DTO Validation
 */
export const createNotificationValidation = [
  body('shopId')
    .notEmpty()
    .withMessage('Shop ID is required')
    .isMongoId()
    .withMessage('Shop ID must be a valid ObjectId'),

  body('recipientType')
    .notEmpty()
    .withMessage('Recipient type is required')
    .isIn(['owner', 'staff', 'all'])
    .withMessage('Recipient type must be owner, staff, or all'),

  body('recipientId')
    .optional()
    .isMongoId()
    .withMessage('Recipient ID must be a valid ObjectId'),

  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isString()
    .withMessage('Message must be a string')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters'),

  body('type')
    .notEmpty()
    .withMessage('Notification type is required')
    .isIn([
      'low_stock',
      'out_of_stock',
      'sale_completed',
      'staff_action',
      'expense_added',
      'system',
      'custom',
    ])
    .withMessage('Invalid notification type'),

  body('inventoryId')
    .optional()
    .isMongoId()
    .withMessage('Inventory ID must be a valid MongoDB ObjectId'),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

/**
 * Create Notification Request Body Interface
 */
export interface CreateNotificationDto {
  shopId: string;
  recipientType: 'owner' | 'staff' | 'all';
  recipientId?: string;
  message?: string;
  type:
    | 'low_stock'
    | 'out_of_stock'
    | 'sale_completed'
    | 'staff_action'
    | 'expense_added'
    | 'system'
    | 'custom';
  inventoryId?: string;
  metadata?: Record<string, any>;
}
