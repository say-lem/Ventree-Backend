import { Request, Response, NextFunction } from "express";
import { AuthorizationError, NotFoundError } from "../../../shared/utils/AppError";
import Shop from "../../auth/models/shop";
import Staff from "../../staff-management/models/staff";

// Extend Express Request to include shop verification
declare global {
  namespace Express {
    interface Request {
      verifiedShop?: {
        shopId: string;
        userRole: "owner" | "cashier" | "manager" | "inventory" | "staff";
        isOwner: boolean;
      };
    }
  }
}

/**
 * Middleware to verify that the user making the request belongs to the shop
 * and is active (for staff) or is the actual owner
 */
export const verifyShopAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { shopId } = req.params;
    const user = req.user;

    if (!shopId) {
      throw new NotFoundError("Shop ID is required");
    }

    if (!user) {
      throw new AuthorizationError("User not authenticated");
    }

    // Check if user's shopId matches the requested shopId
    if (user.shopId !== shopId) {
      throw new AuthorizationError("You do not have access to this shop");
    }

    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new NotFoundError("Shop not found");
    }

    // If user is an owner
    if (user.role === "owner") {
      req.verifiedShop = {
        shopId: shopId.toString(),
        userRole: "owner",
        isOwner: true,
      };

      return next();
    }

    // For staff, verify they belong to this shop and are active
    const staff = await Staff.findOne({
      _id: user.profileId,
      shopId: shopId,
      isActive: true,
    });

    if (!staff) {
      throw new AuthorizationError(
        "You are not registered as staff for this shop"
      );
    }

    if (!staff.isActive) {
      throw new AuthorizationError(
        "Your staff account has been deactivated. Please contact the shop owner."
      );
    }

     req.verifiedShop = {
      shopId: shopId.toString(),
      userRole: staff.role,
      isOwner: false,
    };

    next();
  } catch (error) {
    next(error);
  }
};