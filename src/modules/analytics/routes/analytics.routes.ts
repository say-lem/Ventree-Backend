import { Router } from "express";
import * as analyticsController from "../controllers/analytics.controller";
import * as analyticsValidator from "../validators/analytics.validator";
import { authenticate, verifyShopAccess, requireRole } from "../../../shared/middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get(
  "/:shopId/dashboard",
  analyticsValidator.dashboardOverviewValidator,
  verifyShopAccess,
  requireRole("owner", "staff"),
  analyticsController.getDashboardOverview
);

router.get(
  "/:shopId/sales-trend",
  analyticsValidator.salesTrendValidator,
  verifyShopAccess,
  requireRole("owner", "staff"),
  analyticsController.getSalesTrend
);

router.get(
  "/:shopId/best-sellers",
  analyticsValidator.bestSellersValidator,
  verifyShopAccess,
  requireRole("owner", "staff"),
  analyticsController.getBestSellers
);

router.get(
  "/:shopId/low-stock-alerts",
  analyticsValidator.lowStockAlertsValidator,
  verifyShopAccess,
  requireRole("owner", "staff"),
  analyticsController.getLowStockAlerts
);

router.get(
  "/:shopId/expenses-breakdown",
  analyticsValidator.expensesBreakdownValidator,
  verifyShopAccess,
  requireRole("owner", "staff"),
  analyticsController.getExpensesBreakdown
);

router.get(
  "/:shopId/profit-summary",
  analyticsValidator.profitSummaryValidator,
  verifyShopAccess,
  requireRole("owner", "staff"),
  analyticsController.getProfitSummary
);

export default router;
