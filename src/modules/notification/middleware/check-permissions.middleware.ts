import { Request, Response, NextFunction } from 'express';

/**
 * Check Notification Permission Middleware
 * Validates that the user has permission to manage notifications
 * 
 * TODO: Replace with real StaffService permission check when available
 */
export const checkNotificationPermission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { role, profileId, shopId } = req.user!;
  
  // Owner has full permissions
  if (role === 'ownerProfile') {
    return next();
  }
  
  // Staff permission check (mock implementation)
  if (role === 'staff') {
    // TODO: Replace with real StaffService permission check
    // const permissions = await StaffService.getStaffPermissions(profileId);
    // if (!permissions.notifications) {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Insufficient permissions to manage notifications',
    //   });
    // }
    
    // Mock: Assume staff has notification permissions
    const hasPermission = true;
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to manage notifications',
      });
    }
  }
  
  next();
};

/**
 * Require Owner Role Middleware
 * Ensures only shop owners can access certain routes
 */
export const requireOwner = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ownerProfile') {
    return res.status(403).json({
      success: false,
      error: 'Only shop owners can perform this action',
    });
  }
  
  next();
};
