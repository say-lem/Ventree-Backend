import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Shop from "../models/shop";
import Staff from "../../staff-management/models/staff";
import { generateOTP, sendOTP } from "../utils/otpHandler";
import { hashOTP, verifyOTP } from "../utils/otpHash";
import { logAuditEvent } from "../utils/auditLogger";
import { checkRateLimit, checkOTPCooldown, getLoginAttemptsStore, resetRateLimit } from "../utils/rateLimit";
import { generateTokens } from "../utils/tokens";
import { constantTimeCompare } from "../utils/cryptoUtils";
import { NotificationSettingsService } from "../../notification/services/notification-settings.service";
import {
  RateLimitError,
  ConflictError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  InternalServerError,
} from "../../../shared/utils/AppError";

const OTP_EXPIRY = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const OTP_LOCKOUT_DURATION = 15 * 60 * 1000;
const LOGIN_LOCKOUT_DURATION = 15 * 60 * 1000;

export const registerOwnerService = async ({
  shopName,
  phoneNumber,
  ownerName,
  password,
  ip,
  requestId,
}) => {
  try {
    const cooldown = checkOTPCooldown(phoneNumber);
    if (!cooldown.allowed) {
      throw new RateLimitError(
        `Wait ${cooldown.waitTime}s before requesting another OTP.`,
        cooldown.waitTime
      );
    }

    const existing = await Shop.findOne({ $or: [{ shopName }, { phoneNumber }] });
    if (existing) {
      throw new ConflictError("Shop name or phone number already registered.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    // Create shop first
    const shop = await Shop.create({
      shopName,
      phoneNumber,
      otpHash,
      otpExpiresAt: new Date(Date.now() + OTP_EXPIRY),
      otpAttempts: 0,
      owner: { name: ownerName, passwordHash },
      isVerified: false,
    });

    // 🔥 CREATE STAFF PROFILE FOR THE OWNER
    let ownerStaffProfile;
    try {
      ownerStaffProfile = await Staff.create({
        shopId: shop._id,
        staffName: ownerName,
        phoneNumber: phoneNumber,
        passwordHash: passwordHash,
        role: "manager",
        isActive: true,
        isOwner: true,
      });
    } catch (staffError) {
      console.error("STAFF CREATION ERROR:", staffError);
      await Shop.findByIdAndDelete(shop._id);
      throw new InternalServerError("Failed to initialize owner staff profile.");
    }


    // Try to send OTP, if it fails, delete the shop and throw error
    try {
      await sendOTP(phoneNumber, otp);
    } catch (sendError) {
      await Shop.findByIdAndDelete(shop._id);
      await Staff.deleteOne({ _id: ownerStaffProfile._id });
      throw new InternalServerError("Failed to send OTP. Please try again.");
    }

    await logAuditEvent({ requestId, action: "REGISTER_SUCCESS", ip, shopId: shop.id });

    return {
      message: "OTP sent successfully",
      shopId: shop._id,
      expiresIn: OTP_EXPIRY / 1000,
    };
  } catch (error) {
    // Re-throw AppError instances
    if (
      error instanceof RateLimitError ||
      error instanceof ConflictError ||
      error instanceof InternalServerError
    ) {
      throw error;
    }

    // Log unexpected errors
    await logAuditEvent({
      requestId,
      action: "REGISTER_ERROR",
      ip,
      details: error instanceof Error ? error.message : String(error),
    });

    // Wrap unexpected errors
    throw new InternalServerError("Registration failed. Please try again later.");
  }
};

export const verifyOtpService = async ({ shopName, phoneNumber, otp, ip, requestId }) => {
  try {
    const shop = await Shop.findOne({ shopName, phoneNumber }).select("+otpHash");
    if (!shop) {
      throw new ValidationError("Invalid verification details.");
    }

    // Check if OTP exists
    if (!shop.otpHash) {
      throw new ValidationError("No OTP found. Please request a new one.");
    }

    // Check if OTP is expired
    if (shop.otpExpiresAt && new Date() > shop.otpExpiresAt) {
      shop.otpHash = undefined;
      shop.otpAttempts = 0;
      await shop.save();
      throw new ValidationError("OTP has expired. Please request a new one.");
    }

    // Check if max attempts exceeded
    if (shop.otpAttempts && shop.otpAttempts >= MAX_OTP_ATTEMPTS) {
      const lockoutUntil = shop.otpExpiresAt
        ? new Date(shop.otpExpiresAt.getTime() + OTP_LOCKOUT_DURATION)
        : new Date(Date.now() + OTP_LOCKOUT_DURATION);

      if (new Date() < lockoutUntil) {
        const waitTime = Math.ceil((lockoutUntil.getTime() - Date.now()) / 1000);
        throw new RateLimitError(
          `Too many OTP attempts. Please wait ${waitTime}s before trying again.`,
          waitTime
        );
      } else {
        // Reset attempts if lockout period has passed
        shop.otpAttempts = 0;
      }
    }

    // Verify OTP
    const isValid = await verifyOTP(otp, shop.otpHash);

    if (!isValid) {
      // Increment attempt counter
      shop.otpAttempts = (shop.otpAttempts || 0) + 1;
      await shop.save();

      const remainingAttempts = MAX_OTP_ATTEMPTS - shop.otpAttempts;
      if (remainingAttempts > 0) {
        throw new ValidationError(
          `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts > 1 ? "s" : ""} remaining.`
        );
      } else {
        throw new RateLimitError(
          `Too many failed attempts. Please request a new OTP.`,
          Math.ceil(OTP_LOCKOUT_DURATION / 1000)
        );
      }
    }

    // OTP is valid, verify the shop
    shop.isVerified = true;
    shop.otpHash = undefined;
    shop.otpExpiresAt = undefined;
    shop.otpAttempts = 0;
    await shop.save();

    // Create default notification settings for the shop
    try {
      const settingsService = new NotificationSettingsService();
      await settingsService.createDefaultSettings(shop.id);
      console.log(`[AuthService] Created default notification settings for shop ${shop.id}`);
    } catch (settingsError) {
      // Log but don't fail verification if settings creation fails
      console.error('[AuthService] Failed to create notification settings:', settingsError);
    }

    await logAuditEvent({
      requestId: requestId || crypto.randomUUID(),
      action: "VERIFY_OTP_SUCCESS",
      ip,
      shopId: shop.id,
    });

    return { message: "Phone verified successfully" };
  } catch (error) {
    // Re-throw AppError instances
    if (error instanceof ValidationError || error instanceof RateLimitError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new InternalServerError("OTP verification failed. Please try again.");
  }
};

export const loginUserService = async ({ shopName, phoneNumber, password, ip, requestId }) => {
  try {
    const shop = await Shop.findOne({ shopName }).select("+owner.passwordHash");
    if (!shop) {
      throw new AuthenticationError("Invalid credentials.");
    }
    if (!shop.isVerified) {
      throw new AuthorizationError("Please verify your phone number first.");
    }

    // Check login rate limit
    const loginKey = `login:${shop._id}:${phoneNumber}`;
    const loginAttemptsStore = getLoginAttemptsStore();
    const rateLimitResult = checkRateLimit(
      loginKey,
      loginAttemptsStore,
      MAX_LOGIN_ATTEMPTS,
      LOGIN_LOCKOUT_DURATION
    );

    if (!rateLimitResult.allowed) {
      const waitTime = rateLimitResult.resetAt
        ? Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
        : Math.ceil(LOGIN_LOCKOUT_DURATION / 1000);
      throw new RateLimitError(
        `Too many login attempts. Please wait ${waitTime}s before trying again.`,
        waitTime
      );
    }

    let isAuthenticated = false;
    let role: "owner" | "staff" = "owner";
    let staffData: any = null;

    if (constantTimeCompare(shop.phoneNumber, phoneNumber)) {
      if (await bcrypt.compare(password, shop.owner.passwordHash)) {
        isAuthenticated = true;
      }
      // Fetch the owner's staff profile
      const ownerStaffProfile = await Staff.findOne({
        shopId: shop._id,
        isOwner: true, // or use isOwnerStaff flag
      });

    } else {
      const staff = await Staff.findOne({ shopId: shop._id, phoneNumber, isActive: true }).select(
        "+passwordHash"
      );
      if (staff && (await bcrypt.compare(password, staff.passwordHash))) {
        isAuthenticated = true;
        role = "staff";
        staffData = staff;
      }
    }

    if (!isAuthenticated) {
      throw new AuthenticationError("Invalid credentials.");
    }

    // Reset rate limit on successful login
    resetRateLimit(loginKey, loginAttemptsStore);

    const payload =
      role === "owner"
        ? { shopId: shop._id, role: "owner", profileId: "owner" }
        : {
          shopId: shop._id,
          role: "staff",
          profileId: staffData._id,
          staffName: staffData.staffName,
        };

    const { accessToken, refreshToken } = generateTokens(payload);

    const shopRecord = shop.toObject() as any;
    const shopResponse = {
      id: shopRecord._id,
      shopName: shopRecord.shopName,
      phoneNumber: shopRecord.phoneNumber,
      address: shopRecord.address,
      businessType: shopRecord.businessType,
      isVerified: shopRecord.isVerified,
      kycStatus: shopRecord.kycStatus,
      kycSubmittedAt: shopRecord.kycSubmittedAt,
      owner: {
        name: shopRecord.owner?.name,
        phoneNumber: shopRecord.phoneNumber,
      },
    };

    const ownerResponse = {
      name: shopRecord.owner?.name,
      phoneNumber: shopRecord.phoneNumber,
    };

    let staffResponse: {
      id: any;
      staffName: string;
      phoneNumber: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null = null;
    

if (role === "staff" && staffData) {
  // normal staff login
  staffResponse = {
    id: staffData._id,
    staffName: staffData.staffName,
    phoneNumber: staffData.phoneNumber,
    role: staffData.role,
    isActive: staffData.isActive,
    createdAt: staffData.createdAt,
    updatedAt: staffData.updatedAt,
  };
} else {
  // owner login → return owner's staff profile
  const ownerStaffProfile = await Staff.findOne({
    shopId: shop._id,
    isOwner: true, // this links owner → staff profile
  });

  if (ownerStaffProfile) {
    staffResponse = {
      id: ownerStaffProfile._id,
      staffName: ownerStaffProfile.staffName,
      phoneNumber: ownerStaffProfile.phoneNumber,
      role: ownerStaffProfile.role,
      isActive: ownerStaffProfile.isActive,
      createdAt: ownerStaffProfile.createdAt,
      updatedAt: ownerStaffProfile.updatedAt,
    };
  }
}


    await logAuditEvent({
      requestId: requestId || crypto.randomUUID(),
      action: "LOGIN_SUCCESS",
      ip,
      shopId: shop.id,
      role,
    });

    return {
      message: `${role} login successful`,
      accessToken,
      refreshToken,
      role,
      owner: ownerResponse,
      shop: shopResponse,
      staff: staffResponse,
    };
  } catch (error) {
    // Re-throw AppError instances
    if (
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError ||
      error instanceof RateLimitError
    ) {
      throw error;
    }

    // Wrap unexpected errors
    throw new InternalServerError("Login failed. Please try again later.");
  }
};

export const refreshTokenService = async ({ refreshToken }) => {
  try {
    if (!refreshToken) {
      throw new ValidationError("Refresh token is required.");
    }

    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_REFRESH_SECRET || !JWT_SECRET) {
      throw new InternalServerError("JWT secrets are not configured.");
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as {
      shopId: string;
      role: string;
      profileId: string;
      staffName?: string;
    };

    const payload = {
      shopId: decoded.shopId,
      role: decoded.role,
      profileId: decoded.profileId,
      ...(decoded.staffName && { staffName: decoded.staffName }),
    };

    const newAccess = jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
    return { accessToken: newAccess };
  } catch (error) {
    // Re-throw AppError instances
    if (error instanceof ValidationError || error instanceof InternalServerError) {
      throw error;
    }

    // JWT errors are handled by error middleware, but we can be explicit
    throw new AuthenticationError("Invalid or expired refresh token.");
  }
};

export const resendOtpService = async ({ shopName, phoneNumber, ip, requestId }) => {
  try {
    const cooldown = checkOTPCooldown(phoneNumber);
    if (!cooldown.allowed) {
      throw new RateLimitError(
        `Wait ${cooldown.waitTime}s before retry.`,
        cooldown.waitTime
      );
    }

    const shop = await Shop.findOne({ shopName, phoneNumber }).select("+otpHash");
    if (!shop) {
      throw new ValidationError("Invalid shop name or phone number.");
    }
    if (shop.isVerified) {
      throw new ValidationError("Phone number already verified.");
    }

    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    // Update shop with new OTP and reset attempts
    shop.otpHash = otpHash;
    shop.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY);
    shop.otpAttempts = 0;
    await shop.save();

    // Try to send OTP, if it fails, revert the OTP hash
    try {
      await sendOTP(phoneNumber, otp);
    } catch (sendError) {
      // Revert OTP update if sending fails
      shop.otpHash = undefined;
      shop.otpExpiresAt = undefined;
      await shop.save();
      throw new InternalServerError("Failed to send OTP. Please try again.");
    }

    await logAuditEvent({
      requestId: requestId || crypto.randomUUID(),
      action: "RESEND_OTP_SUCCESS",
      ip,
      shopId: shop.id,
    });

    return { message: "OTP sent successfully" };
  } catch (error) {
    // Re-throw AppError instances
    if (
      error instanceof RateLimitError ||
      error instanceof ValidationError ||
      error instanceof InternalServerError
    ) {
      throw error;
    }

    // Wrap unexpected errors
    throw new InternalServerError("Failed to resend OTP. Please try again later.");
  }
};
