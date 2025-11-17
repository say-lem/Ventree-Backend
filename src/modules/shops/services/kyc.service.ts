import Shop from "../../auth/models/shop";
import { logAuditEvent } from "../../auth/utils/auditLogger";
import {
  checkRateLimit,
  resetRateLimit,
  getShopUpdateAttemptsStore,
} from "../../auth/utils/rateLimit";
import {
  RateLimitError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../../../shared/utils/AppError";
import { BusinessType, KYCStatus } from "../../auth/models/shop";

const KYC_SUBMIT_MAX_ATTEMPTS = 5;
const KYC_SUBMIT_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export const submitKYCService = async (
  shopId: string,
  kycData: {
    address: string;
    businessType: BusinessType;
  },
  auditData?: {
    requestId?: string;
    ip?: string;
  }
) => {
  try {
    // Rate limit check
    const rateLimitKey = `shop:kyc:submit:${shopId}`;
    const rateLimitResult = checkRateLimit(
      rateLimitKey,
      getShopUpdateAttemptsStore(),
      KYC_SUBMIT_MAX_ATTEMPTS,
      KYC_SUBMIT_LOCKOUT_DURATION
    );

    if (!rateLimitResult.allowed) {
      const waitTime = Math.ceil((rateLimitResult.resetAt! - Date.now()) / 1000);
      throw new RateLimitError(
        `Too many KYC submission requests. Please try again in ${waitTime} seconds.`
      );
    }

    const shop = await Shop.findById(shopId);

    if (!shop) {
      throw new NotFoundError("Shop not found");
    }

    // Check if KYC is already verified
    if (shop.kycStatus === KYCStatus.VERIFIED) {
      throw new ConflictError("KYC is already verified. Contact support to update information.");
    }

    // Validate address
    if (!kycData.address || kycData.address.trim().length < 10) {
      throw new ValidationError("Address must be at least 10 characters");
    }

    if (kycData.address.trim().length > 500) {
      throw new ValidationError("Address must not exceed 500 characters");
    }

    // Validate business type
    const businessTypeValues = Object.values(BusinessType);
    if (!businessTypeValues.includes(kycData.businessType)) {
      throw new ValidationError(
        `Invalid business type. Must be one of: ${businessTypeValues.join(", ")}`
      );
    }

    // Update KYC information
    shop.address = kycData.address.trim();
    shop.businessType = kycData.businessType;
    shop.kycStatus = KYCStatus.VERIFIED;
    shop.kycSubmittedAt = new Date();

    await shop.save();

    // Log audit event
    if (auditData) {
      await logAuditEvent({
        requestId: auditData.requestId,
        action: "KYC_SUBMITTED",
        ip: auditData.ip,
        shopId: shopId,
        details: { 
          businessType: kycData.businessType,
          addressLength: kycData.address.length 
        }
      });
    }

    // Reset rate limit on successful submission
    resetRateLimit(rateLimitKey, getShopUpdateAttemptsStore());

    return {
      id: shop._id,
      shopName: shop.shopName,
      businessType: shop.businessType,
      address: shop.address,
      kycStatus: shop.kycStatus,
      kycSubmittedAt: shop.kycSubmittedAt,
      message: "KYC information submitted successfully and is pending review",
    };
  } catch (error) {
    throw error;
  }
};

export const updateKYCService = async (
  shopId: string,
  kycData: {
    address?: string;
    businessType?: BusinessType;
  },
  auditData?: {
    requestId?: string;
    ip?: string;
  }
) => {
  try {
    // Rate limit check
    const rateLimitKey = `shop:kyc:update:${shopId}`;
    const rateLimitResult = checkRateLimit(
      rateLimitKey,
      getShopUpdateAttemptsStore(),
      KYC_SUBMIT_MAX_ATTEMPTS,
      KYC_SUBMIT_LOCKOUT_DURATION
    );

    if (!rateLimitResult.allowed) {
      const waitTime = Math.ceil((rateLimitResult.resetAt! - Date.now()) / 1000);
      throw new RateLimitError(
        `Too many KYC update requests. Please try again in ${waitTime} seconds.`
      );
    }

    const shop = await Shop.findById(shopId);

    if (!shop) {
      throw new NotFoundError("Shop not found");
    }

    // Check if KYC is verified
    if (shop.kycStatus === KYCStatus.VERIFIED) {
      throw new ConflictError("KYC is already verified. Contact support to update information.");
    }

    // Update address if provided
    if (kycData.address !== undefined) {
      if (kycData.address.trim().length < 10) {
        throw new ValidationError("Address must be at least 10 characters");
      }

      if (kycData.address.trim().length > 500) {
        throw new ValidationError("Address must not exceed 500 characters");
      }

      shop.address = kycData.address.trim();
    }

    // Update business type if provided
    if (kycData.businessType) {
      const businessTypeValues = Object.values(BusinessType);
      if (!businessTypeValues.includes(kycData.businessType)) {
        throw new ValidationError(
          `Invalid business type. Must be one of: ${businessTypeValues.join(", ")}`
        );
      }

      shop.businessType = kycData.businessType;
    }

    // Reset KYC status to pending if it was rejected
    if (shop.kycStatus === KYCStatus.REJECTED) {
      shop.kycStatus = KYCStatus.PENDING;
      shop.kycSubmittedAt = new Date();
    }

    await shop.save();

    // Log audit event
    if (auditData) {
      await logAuditEvent({
        requestId: auditData.requestId,
        action: "KYC_UPDATED",
        ip: auditData.ip,
        shopId: shopId,
        details: { updatedFields: Object.keys(kycData) }
      });
    }

    // Reset rate limit on successful update
    resetRateLimit(rateLimitKey, getShopUpdateAttemptsStore());

    return {
      id: shop._id,
      shopName: shop.shopName,
      businessType: shop.businessType,
      address: shop.address,
      kycStatus: shop.kycStatus,
      kycSubmittedAt: shop.kycSubmittedAt,
    };
  } catch (error) {
    throw error;
  }
};

export const getKYCStatusService = async (shopId: string) => {
  try {
    const shop = await Shop.findById(shopId).select(
      "shopName businessType address kycStatus kycSubmittedAt"
    );

    if (!shop) {
      throw new NotFoundError("Shop not found");
    }

    return {
      id: shop._id,
      shopName: shop.shopName,
      businessType: shop.businessType,
      address: shop.address,
      kycStatus: shop.kycStatus,
      kycSubmittedAt: shop.kycSubmittedAt,
    };
  } catch (error) {
    throw error;
  }
};