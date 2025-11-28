import { param, query } from "express-validator";

export const dashboardOverviewValidator = [
  param("shopId").isMongoId().withMessage("Invalid shop ID"),
];

export const salesTrendValidator = [
  param("shopId").isMongoId().withMessage("Invalid shop ID"),
  query("days")
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage("Days must be between 1 and 90"),
  query("includeRefunded")
    .optional()
    .isBoolean()
    .withMessage("includeRefunded must be boolean"),
];

export const bestSellersValidator = [
  param("shopId").isMongoId().withMessage("Invalid shop ID"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
];

export const lowStockAlertsValidator = [
  param("shopId").isMongoId().withMessage("Invalid shop ID"),
];

export const expensesBreakdownValidator = [
  param("shopId").isMongoId().withMessage("Invalid shop ID"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
];

export const profitSummaryValidator = [
  param("shopId").isMongoId().withMessage("Invalid shop ID"),
  query("period")
    .optional()
    .isIn(["daily", "weekly", "monthly"])
    .withMessage("period must be daily, weekly, or monthly"),
  query("periods")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("periods must be between 1 and 365"),
];
