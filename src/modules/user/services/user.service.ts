import bcrypt from "bcryptjs";
import crypto from "crypto";
import Shop from "../../auth/models/shop";
import Staff from "../../staff-management/models/staff";
import Sale from "../../sales-management/models/sales";
import Expense from "../../expenses/models/expenses";
import Inventory from "../../inventory-mgt/models/Inventory";
import { generateOTP, sendOTP } from "../../auth/utils/otpHandler";
import { hashOTP, verifyOTP } from "../../auth/utils/otpHash";
import { logAuditEvent } from "../../auth/utils/auditLogger";
import { checkOTPCooldown } from "../../auth/utils/rateLimit";
import {
  RateLimitError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  InternalServerError,
} from "../../../shared/utils/AppError";
import { Types } from "mongoose";
import type {
  ResetTokenEntry,
  ResetTokenStore,
  PasswordResetRequestInput,
  VerifyPasswordResetOtpInput,
  ResetPasswordInput,
  ChangePasswordInput,
  DashboardPeriod,
} from "../types";

const OTP_EXPIRY = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes

// Store for reset tokens (in production, use Redis)
const resetTokenStore: ResetTokenStore = new Map();

export class UserService {
  constructor(private readonly tokenStore: ResetTokenStore = resetTokenStore) {}

  // Request password reset
  public async requestPasswordReset({
    shopName,
    phoneNumber,
    ip,
    requestId,
  }: PasswordResetRequestInput) {
    try {
      const cooldown = checkOTPCooldown(phoneNumber);
      if (!cooldown.allowed) {
        throw new RateLimitError(
          `Wait ${cooldown.waitTime}s before requesting another OTP.`,
          cooldown.waitTime
        );
      }

      const shop = await Shop.findOne({ shopName, phoneNumber });
      if (!shop) {
        throw new NotFoundError("Shop not found with the provided details.");
      }

      if (!shop.isVerified) {
        throw new ValidationError("Please verify your phone number first.");
      }

      const otp = generateOTP();
      const otpHash = await hashOTP(otp);

      // Store OTP in shop's password reset fields (we'll use otpHash temporarily)
      shop.otpHash = otpHash;
      shop.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY);
      shop.otpAttempts = 0;
      await shop.save();

      try {
        await sendOTP(phoneNumber, otp);
      } catch (sendError) {
        shop.otpHash = undefined;
        shop.otpExpiresAt = undefined;
        await shop.save();
        throw new InternalServerError("Failed to send OTP. Please try again.");
      }

      await logAuditEvent({
        requestId,
        action: "PASSWORD_RESET_REQUESTED",
        ip,
        shopId: shop.id,
      });

      return {
        message: "OTP sent successfully for password reset",
        shopId: shop._id,
        expiresIn: OTP_EXPIRY / 1000,
      };
    } catch (error) {
      if (
        error instanceof RateLimitError ||
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof InternalServerError
      ) {
        throw error;
      }

      throw new InternalServerError("Password reset request failed. Please try again later.");
    }
  }

  // Verify password reset OTP
  public async verifyPasswordResetOtp({
    shopName,
    phoneNumber,
    otp,
    ip,
    requestId,
  }: VerifyPasswordResetOtpInput) {
    try {
      const shop = await Shop.findOne({ shopName, phoneNumber }).select("+otpHash");
      if (!shop) {
        throw new NotFoundError("Shop not found.");
      }

      if (!shop.otpHash) {
        throw new ValidationError("No OTP found. Please request a new one.");
      }

      if (shop.otpExpiresAt && new Date() > shop.otpExpiresAt) {
        shop.otpHash = undefined;
        shop.otpAttempts = 0;
        await shop.save();
        throw new ValidationError("OTP has expired. Please request a new one.");
      }

      if (shop.otpAttempts && shop.otpAttempts >= MAX_OTP_ATTEMPTS) {
        const lockoutUntil = shop.otpExpiresAt
          ? new Date(shop.otpExpiresAt.getTime() + 15 * 60 * 1000)
          : new Date(Date.now() + 15 * 60 * 1000);

        if (new Date() < lockoutUntil) {
          const waitTime = Math.ceil((lockoutUntil.getTime() - Date.now()) / 1000);
          throw new RateLimitError(
            `Too many OTP attempts. Please wait ${waitTime}s before trying again.`,
            waitTime
          );
        } else {
          shop.otpAttempts = 0;
        }
      }

      const isValid = await verifyOTP(otp, shop.otpHash);

      if (!isValid) {
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
            Math.ceil(15 * 60)
          );
        }
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY);

      this.tokenStore.set(resetToken, {
        shopId: shop.id,
        phoneNumber: shop.phoneNumber,
        expiresAt,
      });

      // Clear OTP from shop
      shop.otpHash = undefined;
      shop.otpExpiresAt = undefined;
      shop.otpAttempts = 0;
      await shop.save();

      await logAuditEvent({
        requestId: requestId || crypto.randomUUID(),
        action: "PASSWORD_RESET_OTP_VERIFIED",
        ip,
        shopId: shop.id,
      });

      return {
        message: "OTP verified successfully",
        resetToken,
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof RateLimitError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }

      throw new InternalServerError("OTP verification failed. Please try again.");
    }
  }

  // Reset password
  public async resetPassword({ resetToken, newPassword, ip, requestId }: ResetPasswordInput) {
    try {
      const tokenData = this.tokenStore.get(resetToken);
      if (!tokenData) {
        throw new ValidationError("Invalid or expired reset token.");
      }

      if (new Date() > tokenData.expiresAt) {
        this.tokenStore.delete(resetToken);
        throw new ValidationError("Reset token has expired. Please request a new password reset.");
      }

      const shop = await Shop.findById(tokenData.shopId).select("+owner.passwordHash");
      if (!shop) {
        this.tokenStore.delete(resetToken);
        throw new NotFoundError("Shop not found.");
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update shop owner password
      shop.owner.passwordHash = passwordHash;
      await shop.save();

      // Also update owner's staff profile password if exists
      const ownerStaffProfile = await Staff.findOne({
        shopId: shop._id,
        isOwner: true,
      }).select("+passwordHash");

      if (ownerStaffProfile) {
        ownerStaffProfile.passwordHash = passwordHash;
        await ownerStaffProfile.save();
      }

      // Delete reset token
      this.tokenStore.delete(resetToken);

      await logAuditEvent({
        requestId: requestId || crypto.randomUUID(),
        action: "PASSWORD_RESET_SUCCESS",
        ip,
        shopId: shop.id,
      });

      return {
        message: "Password reset successfully",
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }

      throw new InternalServerError("Password reset failed. Please try again later.");
    }
  }

  // Change password (authenticated user)
  public async changePassword({
    shopId,
    role,
    profileId,
    currentPassword,
    newPassword,
    ip,
    requestId,
  }: ChangePasswordInput) {
    try {
      let passwordHash: string | null = null;

      if (role === "owner") {
        const shop = await Shop.findById(shopId).select("+owner.passwordHash");
        if (!shop) {
          throw new NotFoundError("Shop not found.");
        }

        if (!(await bcrypt.compare(currentPassword, shop.owner.passwordHash))) {
          throw new AuthenticationError("Current password is incorrect.");
        }

        passwordHash = await bcrypt.hash(newPassword, 12);
        shop.owner.passwordHash = passwordHash;
        await shop.save();

        // Also update owner's staff profile
        const ownerStaffProfile = await Staff.findOne({
          shopId: shop._id,
          isOwner: true,
        }).select("+passwordHash");

        if (ownerStaffProfile) {
          ownerStaffProfile.passwordHash = passwordHash;
          await ownerStaffProfile.save();
        }
      } else {
        // Staff member
        const staff = await Staff.findById(profileId).select("+passwordHash");
        if (!staff) {
          throw new NotFoundError("Staff member not found.");
        }

        if (staff.shopId.toString() !== shopId) {
          throw new AuthenticationError("Unauthorized access.");
        }

        if (!(await bcrypt.compare(currentPassword, staff.passwordHash))) {
          throw new AuthenticationError("Current password is incorrect.");
        }

        passwordHash = await bcrypt.hash(newPassword, 12);
        staff.passwordHash = passwordHash;
        await staff.save();
      }

      await logAuditEvent({
        requestId: requestId || crypto.randomUUID(),
        action: "PASSWORD_CHANGED",
        ip,
        shopId,
        details: { role, profileId },
      });

      return {
        message: "Password changed successfully",
      };
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof NotFoundError) {
        throw error;
      }

      throw new InternalServerError("Password change failed. Please try again later.");
    }
  }

  // Get shop dashboard with metrics
  public async getShopDashboard(shopId: string, period: DashboardPeriod = "today") {
    try {
      // Validate period
      if (period !== "today" && period !== "week") {
        throw new ValidationError("Period must be 'today' or 'week'");
      }

      // Get shop details
      const shop = await Shop.findById(shopId).select("-owner.passwordHash -otpHash -otpExpiresAt -otpAttempts");
      if (!shop) {
        throw new NotFoundError("Shop not found.");
      }

      // Calculate date ranges
      const now = new Date();
      let startDate: Date;
      const endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      if (period === "today") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      } else {
        // Week: start of week (Sunday = 0) to end of today
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek;
        startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      }

      // Get owner's staff profile
      const ownerStaffProfile = await Staff.findOne({
        shopId: shop._id,
        isOwner: true,
      });

      // Query sales for the period
      const salesMatch: Record<string, unknown> = {
        shopId: new Types.ObjectId(shopId),
        refunded: false,
        date: { $gte: startDate, $lte: endDate },
      };

      const salesAggregation = await Sale.aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            totalProfit: { $sum: "$totalProfit" },
          },
        },
      ]);

      const salesData = salesAggregation[0] || { totalRevenue: 0, totalProfit: 0 };

      // Query expenses for the period
      const expensesMatch: Record<string, unknown> = {
        shopId: new Types.ObjectId(shopId),
        createdAt: { $gte: startDate, $lte: endDate },
      };

      const expensesAggregation = await Expense.aggregate([
        { $match: expensesMatch },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" },
          },
        },
      ]);

      const expensesData = expensesAggregation[0] || { totalExpenses: 0 };

      // Get low stock items 
      const lowStockItemsList = await Inventory.find({
        shopId: new Types.ObjectId(shopId),
        isActive: true,
        isLowStock: true,
      })
        .select("_id name sku category availableQuantity reorderLevel unit sellingPrice costPrice")
        .sort({ availableQuantity: 1 })
        .lean();

      const lowStockCount = lowStockItemsList.length;

      // Format low stock items for response
      const formattedLowStockItems = lowStockItemsList.map((item: any) => ({
        id: item._id.toString(),
        name: item.name,
        sku: item.sku,
        category: item.category,
        availableQuantity: item.availableQuantity,
        reorderLevel: item.reorderLevel,
        unit: item.unit,
        sellingPrice: item.sellingPrice,
        costPrice: item.costPrice,
      }));

      // Calculate profit (revenue - expenses)
      const profit = salesData.totalProfit - expensesData.totalExpenses;

      // Format shop response (similar to login response)
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

      let staffResponse: any = null;
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

      return {
        shop: shopResponse,
        owner: ownerResponse,
        staff: staffResponse,
        dashboard: {
          period,
          sales: salesData.totalRevenue,
          expenses: expensesData.totalExpenses,
          lowStockItems: {
            count: lowStockCount,
            items: formattedLowStockItems,
          },
          profit,
        },
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }

      throw new InternalServerError("Failed to fetch dashboard data. Please try again later.");
    }
  }
}

export const userService = new UserService();