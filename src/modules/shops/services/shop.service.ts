import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Shop from "../../auth/models/shop";
import Staff from "../../auth//models/staff";
import { logAuditEvent } from "../../auth/utils/auditLogger";
import { checkRateLimit, getShopUpdateAttemptsStore, resetRateLimit } from "../../auth/utils/rateLimit";
import { BusinessType, KYCStatus } from "../../auth/models/shop";

import {
  RateLimitError,
  ConflictError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  InternalServerError,
} from "../../../shared/utils/AppError";
import { error } from "console";
import shop from "../../auth/models/shop";


// Rate limit configuration for shop operations
const SHOP_UPDATE_MAX_ATTEMPTS = 10; // Max 10 updates per window
const SHOP_UPDATE_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const SHOP_PROFILE_VIEW_MAX_ATTEMPTS = 50; // Max 50 profile views per window
const SHOP_PROFILE_VIEW_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const KYC_SUBMIT_MAX_ATTEMPTS = 5;
const KYC_SUBMIT_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Get shop information
export const getShopProfileService = async (shopId) => {
    console.log(shopId)
    try {
        // Rate limit check for profile views
        const rateLimitKey = `shop:profile:view:${shopId}`;
        const rateLimitResult = checkRateLimit(
        rateLimitKey,
        getShopUpdateAttemptsStore(),
        SHOP_PROFILE_VIEW_MAX_ATTEMPTS,
        SHOP_PROFILE_VIEW_LOCKOUT_DURATION
        );

        if (!rateLimitResult.allowed) {
            const waitTime = Math.ceil((rateLimitResult.resetAt! - Date.now()) / 1000);
            throw new RateLimitError(
                `Too many profile view requests. Please try again in ${waitTime} seconds.`
            );
        }

        const shop = await Shop.findById(shopId).select("-owner.passwordHash -otpHash -otpExpiresAt -otpAttempts");
        if (!shop) {
            throw new NotFoundError("Invalid shop id, shop does not exist.");
        }

        return shop;
    } catch (error) {
        throw error;
    }
}

// Update shop profile
export const updateShopProfileService = async (
  shopId: string,
  ip,
  requestId,
  updateData: {
    shopName?: string;
    phoneNumber?: string;
    ownerName?: string;
    businessType?: BusinessType;
    address?: string;
  }
) => {
  try {
    // Rate limit check for profile updates
    const rateLimitKey = `shop:profile:update:${shopId}`;
    const rateLimitResult = checkRateLimit(
      rateLimitKey,
      getShopUpdateAttemptsStore(),
      SHOP_UPDATE_MAX_ATTEMPTS,
      SHOP_UPDATE_LOCKOUT_DURATION
    );

    if (!rateLimitResult.allowed) {
      const waitTime = Math.ceil((rateLimitResult.resetAt! - Date.now()) / 1000);
      throw new RateLimitError(
        `Too many update requests. Please try again in ${waitTime} seconds.`
      );
    }

    // find shop
    const shop = await Shop.findById(shopId);
    console.log(shop?.address)

    if (!shop) {
      throw new NotFoundError("Shop not found");
    }

    // Update fields if provided
    if (updateData.shopName) {
      // Check if shopName is already taken by another shop
      const existingShop = await Shop.findOne({ 
        shopName: updateData.shopName,
        _id: { $ne: shopId } 
      });
      
      if (existingShop) {
        throw new ValidationError("Shop name is already taken");
      }
      
      shop.shopName = updateData.shopName;
    }

    if (updateData.phoneNumber) {
      // Check if phoneNumber is already taken by another shop
      const existingShop = await Shop.findOne({ 
        phoneNumber: updateData.phoneNumber,
        _id: { $ne: shopId } 
      });
      
      if (existingShop) {
        throw new ValidationError("Phone number is already registered");
      }
      
      shop.phoneNumber = updateData.phoneNumber;
    }

    // Update owner name
    if (updateData.ownerName) {
      if (updateData.ownerName.trim().length < 2 || updateData.ownerName.trim().length > 50) {
        throw new ValidationError("Owner name must be between 2 and 50 characters");
      }
      shop.owner.name = updateData.ownerName;
    }


    // Update business type
    if (updateData.businessType) {
      const businessTypeValues = Object.values(BusinessType);
      
      if (!businessTypeValues.includes(updateData.businessType)) {
        throw new ValidationError(
          `Invalid business type. Must be one of: ${businessTypeValues.join(", ")}`
        );
      }

      shop.businessType = updateData.businessType;
    }


    // Update address
    if (updateData.address !== undefined) {
      if (updateData.address && updateData.address.trim().length > 500) {
        throw new ValidationError("Address must not exceed 500 characters");
      }

      shop.address = updateData.address.trim();
    }



    // Save shop
    await shop.save();


    // Log audit event
    await logAuditEvent({
        requestId: requestId,
        action: "SHOP_PROFILE_UPDATE",
        ip: ip,
        shopId: shopId,
        details: { updatedFields: Object.keys(updateData) }
    });

    // await logAuditEvent({ requestId, action: "SHOP_PROFILE_UPDATE", ip, shopId: shop.id });
   

    // Reset rate limit on successful update
    resetRateLimit(rateLimitKey, getShopUpdateAttemptsStore());


    return shop
  } catch (error) {
    throw error;
  }
};