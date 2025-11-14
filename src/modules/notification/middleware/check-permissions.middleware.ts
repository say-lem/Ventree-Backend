import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../shared/middleware/auth.middleware';

/**
 * Check Notification Permission Middleware
 * Validates that the user has permission to manage notifications
 * Both owners and staff can access notifications
 */
export const checkNotificationPermission = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }
  
  // Both owners and staff can access notifications
  // Owners see all shop notifications
  // Staff see only their own notifications (enforced in service layer)
  next();
};

/**
 * Require Owner Role Middleware
 * Ensures only shop owners can access certain routes
 */
export const requireOwner = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'owner') {
    res.status(403).json({
      success: false,
      message: 'Only shop owners can perform this action',
    });
    return;
  }
  
  next();
};
