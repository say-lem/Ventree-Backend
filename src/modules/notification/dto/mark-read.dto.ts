import { body } from 'express-validator';

/**
 * Mark Read Validation
 */
export const markReadValidation = [
  body('notificationIds')
    .notEmpty()
    .withMessage('Notification IDs are required')
    .isArray({ min: 1 })
    .withMessage('Notification IDs must be a non-empty array'),

  body('notificationIds.*')
    .isString()
    .withMessage('Each notification ID must be a string')
    .isMongoId()
    .withMessage('Each notification ID must be a valid MongoDB ObjectId'),
];

/**
 * Mark Read Request Body Interface
 */
export interface MarkReadDto {
  notificationIds: string[];
}
