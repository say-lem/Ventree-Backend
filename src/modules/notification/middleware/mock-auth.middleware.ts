import { Request, Response, NextFunction } from 'express';
import { MockAuthContext } from '../interfaces/mock-auth.interface';

/**
 * Extend Express Request to include user context
 */
declare global {
  namespace Express {
    interface Request {
      user?: MockAuthContext;
    }
  }
}

/**
 * Mock Auth Middleware
 * This will be replaced with real JWT verification when AuthService is ready
 * 
 * For testing, accepts auth context from headers:
 * - x-mock-user-id: User ID
 * - x-mock-shop-id: Shop ID
 * - x-mock-role: Role (ownerProfile or staff)
 * - x-mock-profile-id: Profile ID (ownerProfileId or staffId)
 * - x-mock-replica-id: CRDT replica identifier
 */
export const mockAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // TODO: Replace with real JWT verification when AuthService is ready
  // const token = req.headers.authorization?.split(' ')[1];
  // const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  // For now, accept auth context from headers or use defaults
  req.user = {
    userId: parseInt(req.headers['x-mock-user-id'] as string) || 1,
    shopId: parseInt(req.headers['x-mock-shop-id'] as string) || 1,
    role: (req.headers['x-mock-role'] as 'ownerProfile' | 'staff') || 'ownerProfile',
    profileId: parseInt(req.headers['x-mock-profile-id'] as string) || 1,
    replicaId: (req.headers['x-mock-replica-id'] as string) || `mock-${Date.now()}`,
  };
  
  next();
};

/**
 * Require Authentication Middleware
 * Ensures user is authenticated before accessing protected routes
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }
  
  next();
};
