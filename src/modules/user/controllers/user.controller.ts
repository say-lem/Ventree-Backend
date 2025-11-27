import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { AuthenticatedRequest } from "../../../shared/middleware/auth.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { userService } from "../services/user.service";
import { getAuthenticatedUser } from "../../../shared/middleware/auth.middleware";
import type { DashboardPeriod } from "../types";

// Request password reset
export const requestPasswordResetController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { shopName, phoneNumber } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const requestId = (req as any).id || crypto.randomUUID();

    const result = await userService.requestPasswordReset({
      shopName,
      phoneNumber,
      ip,
      requestId,
    });

    res.status(200).json({
      success: true,
      message: result.message,
      shopId: result.shopId,
      expiresIn: result.expiresIn,
    });
  }
);

// Verify password reset OTP
export const verifyPasswordResetOtpController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { shopName, phoneNumber, otp } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const requestId = (req as any).id || crypto.randomUUID();

    const result = await userService.verifyPasswordResetOtp({
      shopName,
      phoneNumber,
      otp,
      ip,
      requestId,
    });

    res.status(200).json({
      success: true,
      message: result.message,
      resetToken: result.resetToken,
    });
  }
);

// Reset password
export const resetPasswordController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { resetToken, newPassword } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const requestId = (req as any).id || crypto.randomUUID();

    const result = await userService.resetPassword({
      resetToken,
      newPassword,
      ip,
      requestId,
    });

    res.status(200).json({
      success: true,
      message: result.message,
    });
  }
);

// Change password (authenticated user)
export const changePasswordController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = getAuthenticatedUser(req);
    const { currentPassword, newPassword } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const requestId = (req as any).id || crypto.randomUUID();

    const result = await userService.changePassword({
      shopId: user.shopId,
      role: user.role,
      profileId: user.profileId,
      currentPassword,
      newPassword,
      ip,
      requestId,
    });

    res.status(200).json({
      success: true,
      message: result.message,
    });
  }
);

// Get shop dashboard
export const getShopDashboardController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = getAuthenticatedUser(req);
    const { shopId } = req.params;
    const { period } = req.query; // period can be "today" or "week"

    // Verify user has access to this shop
    if (user.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You don't have permission to access this shop.",
      });
    }

    const normalizedPeriod: DashboardPeriod =
      typeof period === "string" && period === "week" ? "week" : "today";

    const dashboard = await userService.getShopDashboard(shopId, normalizedPeriod);

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  }
);

