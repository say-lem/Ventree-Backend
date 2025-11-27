import { Response } from "express";
import { validationResult } from "express-validator";
import crypto from "crypto";
import { AnalyticsService } from "../services/analytics.service";
import { AuthenticatedRequest } from "../../../shared/middleware/auth.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { ValidationError, AuthenticationError } from "../../../shared/utils/AppError";

const analyticsService = new AnalyticsService();

export const getDashboardOverview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const requestId = crypto.randomUUID();
    const { shopId } = req.params;

    const overview = await analyticsService.getDashboardOverview(shopId, {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.profileId,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    });

    res.status(200).json({
      success: true,
      message: "Dashboard overview retrieved successfully",
      data: overview,
    });
  }
);

export const getSalesTrend = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const requestId = crypto.randomUUID();
    const { shopId } = req.params;
    const { days = "7", includeRefunded = "false" } = req.query;

    const parsedDays = parseInt(days as string, 10) || 7;
    const includeRefundedFlag = includeRefunded === "true";

    const trend = await analyticsService.getSalesTrend(shopId, parsedDays, includeRefundedFlag, {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.profileId,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    });

    res.status(200).json({
      success: true,
      message: "Sales trend retrieved successfully",
      data: trend,
    });
  }
);

export const getBestSellers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const requestId = crypto.randomUUID();
    const { shopId } = req.params;
    const { limit = "5", startDate, endDate } = req.query;

    const parsedLimit = parseInt(limit as string, 10) || 5;

    const bestSellers = await analyticsService.getBestSellers(
      shopId,
      {
        limit: parsedLimit,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      },
      {
        requestId,
        ip: req.ip || "unknown",
        userId: req.user.profileId,
        userRole: req.user.role,
        userShopId: req.user.shopId,
      }
    );

    res.status(200).json({
      success: true,
      message: "Best sellers retrieved successfully",
      data: bestSellers,
    });
  }
);

export const getLowStockAlerts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const requestId = crypto.randomUUID();
    const { shopId } = req.params;

    const alerts = await analyticsService.getLowStockAlerts(shopId, {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.profileId,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    });

    res.status(200).json({
      success: true,
      message: "Low stock alerts retrieved successfully",
      data: alerts,
    });
  }
);

export const getExpensesBreakdown = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const requestId = crypto.randomUUID();
    const { shopId } = req.params;
    const { startDate, endDate } = req.query;

    const breakdown = await analyticsService.getExpensesBreakdown(
      shopId,
      {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      },
      {
        requestId,
        ip: req.ip || "unknown",
        userId: req.user.profileId,
        userRole: req.user.role,
        userShopId: req.user.shopId,
      }
    );

    res.status(200).json({
      success: true,
      message: "Expenses breakdown retrieved successfully",
      data: breakdown,
    });
  }
);

export const getProfitSummary = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const requestId = crypto.randomUUID();
    const { shopId } = req.params;
    const { period = "weekly", weeks = "4" } = req.query;

    const parsedWeeks = parseInt(weeks as string, 10) || 4;
    const parsedPeriod = (period as string) === "monthly" ? "monthly" : "weekly";

    const summary = await analyticsService.getProfitSummary(
      shopId,
      parsedPeriod,
      parsedWeeks,
      {
        requestId,
        ip: req.ip || "unknown",
        userId: req.user.profileId,
        userRole: req.user.role,
        userShopId: req.user.shopId,
      }
    );

    res.status(200).json({
      success: true,
      message: "Profit summary retrieved successfully",
      data: summary,
    });
  }
);
