import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in environment variables");
}

/**
 * Token payload interface
 */
export interface TokenPayload {
  shopId: string;
  role: "owner" | "staff";
  profileId: string;
  staffName?: string;
  iat?: number;
  exp?: number;
}

/**
 * Extended Request interface with user property
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Main authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please provide an access token.",
      });
      return;
    }

    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Invalid token format. Use 'Bearer <token>'.",
      });
      return;
    }

    // Extract token (remove "Bearer " prefix)
    const token = authHeader.substring(7);

    if (!token || token.trim() === "") {
      res.status(401).json({
        success: false,
        message: "Token is missing.",
      });
      return;
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

      // Attach user info to request
      req.user = {
        shopId: decoded.shopId,
        role: decoded.role,
        profileId: decoded.profileId,
        ...(decoded.staffName && { staffName: decoded.staffName }),
      };

      next();
    } catch (jwtError: any) {
      if (jwtError.name === "TokenExpiredError") {
        res.status(401).json({
          success: false,
          message: "Token has expired. Please login again or refresh your token.",
          code: "TOKEN_EXPIRED",
        });
        return;
      }

      if (jwtError.name === "JsonWebTokenError") {
        res.status(401).json({
          success: false,
          message: "Invalid token. Please login again.",
          code: "INVALID_TOKEN",
        });
        return;
      }

      if (jwtError.name === "NotBeforeError") {
        res.status(401).json({
          success: false,
          message: "Token not yet valid.",
          code: "TOKEN_NOT_ACTIVE",
        });
        return;
      }

      // Generic JWT error
      res.status(401).json({
        success: false,
        message: "Token verification failed.",
      });
      return;
    }
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during authentication.",
    });
    return;
  }
};

/**
 * Owner-only middleware
 * Must be used after authenticate middleware
 * Restricts access to shop owners only
 */
export const ownerOnly = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
    return;
  }

  if (req.user.role !== "owner") {
    res.status(403).json({
      success: false,
      message: "Access denied. This action is only available to shop owners.",
      code: "OWNER_ONLY",
    });
    return;
  }

  next();
};

/**
 * Staff-only middleware
 * Must be used after authenticate middleware
 * Restricts access to staff members only
 */
export const staffOnly = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
    return;
  }

  if (req.user.role !== "staff") {
    res.status(403).json({
      success: false,
      message: "Access denied. This action is only available to staff members.",
      code: "STAFF_ONLY",
    });
    return;
  }

  next();
};

/**
 * Verify shop access middleware
 * Ensures user has access to the specified shop
 * Checks shopId from params or body
 */
export const verifyShopAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
    return;
  }

  // Get shopId from params or body
  const shopId = req.params.shopId || req.body.shopId;

  if (!shopId) {
    res.status(400).json({
      success: false,
      message: "Shop ID is required.",
    });
    return;
  }

  // Verify user has access to this shop
  if (req.user.shopId !== shopId) {
    res.status(403).json({
      success: false,
      message: "Access denied. You don't have permission to access this shop.",
      code: "SHOP_ACCESS_DENIED",
    });
    return;
  }

  next();
};

/**
 * Optional authentication middleware
 * Attaches user info if token is provided, but doesn't fail if missing
 * Useful for endpoints that work differently for authenticated vs unauthenticated users
 */
export const optionalAuthenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No token provided, continue without user info
      next();
      return;
    }

    const token = authHeader.substring(7);

    if (!token || token.trim() === "") {
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

      req.user = {
        shopId: decoded.shopId,
        role: decoded.role,
        profileId: decoded.profileId,
        ...(decoded.staffName && { staffName: decoded.staffName }),
      };
    } catch (jwtError) {
      // Token is invalid, but we don't fail the request
      console.warn("Optional authentication failed:", jwtError);
    }

    next();
  } catch (error) {
    console.error("Optional authentication error:", error);
    next();
  }
};

/**
 * Self or owner middleware
 * Allows access if user is accessing their own resource OR if they're the shop owner
 * Useful for staff profile updates where staff can update their own profile
 */
export const selfOrOwner = (resourceIdParam: string = "staffId") => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const resourceId = req.params[resourceIdParam];

    if (!resourceId) {
      res.status(400).json({
        success: false,
        message: `${resourceIdParam} is required.`,
      });
      return;
    }

    // Allow if user is owner OR accessing their own resource
    const isOwner = req.user.role === "owner";
    const isSelf = req.user.profileId === resourceId;

    if (!isOwner && !isSelf) {
      res.status(403).json({
        success: false,
        message: "Access denied. You can only access your own resource or be a shop owner.",
        code: "SELF_OR_OWNER_REQUIRED",
      });
      return;
    }

    next();
  };
};

/**
 * Role-based access control middleware
 * Accepts multiple roles
 */
export const requireRole = (...roles: Array<"owner" | "staff">) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(", ")}`,
        code: "INSUFFICIENT_PERMISSIONS",
      });
      return;
    }

    next();
  };
};

/**
 * Verify staff belongs to shop middleware
 * Ensures the staff member being accessed belongs to the authenticated user's shop
 */
export const verifyStaffBelongsToShop = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
    return;
  }

  const { staffId, shopId } = req.params;

  if (!staffId || !shopId) {
    res.status(400).json({
      success: false,
      message: "Staff ID and Shop ID are required.",
    });
    return;
  }

  // Verify the shop in the request matches the user's shop
  if (req.user.shopId !== shopId) {
    res.status(403).json({
      success: false,
      message: "Access denied. Staff member does not belong to your shop.",
      code: "SHOP_MISMATCH",
    });
    return;
  }

  next();
};

/**
 * Rate limiting check middleware
 * Can be customized per route
 */
export const checkRateLimit = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) => {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Skip rate limiting for unauthenticated requests
      next();
      return;
    }

    const key = `${req.user.shopId}:${req.user.profileId}`;
    const now = Date.now();
    const record = requests.get(key);

    if (!record || now > record.resetAt) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
        retryAfter,
      });
      return;
    }

    record.count++;
    next();
  };
};

/**
 * API Key authentication (optional, for server-to-server calls)
 */
export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      message: "API key is required.",
    });
    return;
  }

  // Check against environment variable or database
  const validApiKey = process.env.API_KEY;

  if (apiKey !== validApiKey) {
    res.status(401).json({
      success: false,
      message: "Invalid API key.",
    });
    return;
  }

  next();
};

/**
 * Helper function to get user from request
 * Use this in controllers to safely access user info
 */
export const getAuthenticatedUser = (req: AuthenticatedRequest): TokenPayload => {
  if (!req.user) {
    throw new Error("User not authenticated. Use authenticate middleware first.");
  }
  return req.user;
};

/**
 * Helper function to check if user is owner
 */
export const isOwner = (req: AuthenticatedRequest): boolean => {
  return req.user?.role === "owner";
};

/**
 * Helper function to check if user is staff
 */
export const isStaff = (req: AuthenticatedRequest): boolean => {
  return req.user?.role === "staff";
};