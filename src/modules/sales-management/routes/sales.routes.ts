import express from "express";
import {
  recordSale,
  getSalesList,
  getSaleById,
  updateSale,
  refundSale,
  deleteSale,
  getSalesAnalytics,
  searchSales,
  generateSalesReport,
  getTopPerformingItems,
  getStaffPerformance,
  recordCreditPayment,
  getCreditSales,
  getCreditSalesSummary,
  getOverdueCreditSales,
  getCustomerCreditHistory,
} from "../controllers/sales.controller";
import {
  recordSaleValidation,
  updateSaleValidation,
  refundSaleValidation,
  shopIdValidation,
  saleIdValidation,
  getSalesValidation,
  recordCreditPaymentValidation,
  getCreditSalesValidation,
  customerPhoneValidation,
  analyticsValidation,
  searchSalesValidation,
} from "../validators/sale.validator";
import {
  authenticate,
  ownerOnly,
  verifyShopAccess,
  requireRole,
} from "../../../shared/middleware/auth.middleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Base sales route
router.post("/", recordSaleValidation, recordSale);

// Sales list with filters
router.get(
  "/:shopId/list",
  getSalesValidation,
  verifyShopAccess,
  getSalesList
);

// Analytics
router.get(
  "/:shopId/analytics",
  analyticsValidation,
  verifyShopAccess,
  requireRole("owner", "staff"),
  getSalesAnalytics
);

// Reports (owner only)
router.get(
  "/:shopId/report",
  shopIdValidation,
  verifyShopAccess,
  ownerOnly,
  generateSalesReport
);

// Search
router.get(
  "/:shopId/search",
  searchSalesValidation,
  verifyShopAccess,
  searchSales
);

// Top performing items
router.get(
  "/:shopId/top-items",
  shopIdValidation,
  verifyShopAccess,
  getTopPerformingItems
);

// Staff performance (owner only)
router.get(
  "/:shopId/staff-performance",
  shopIdValidation,
  verifyShopAccess,
  ownerOnly,
  getStaffPerformance
);


// Get all credit sales
router.get(
  "/:shopId/credit",
  getCreditSalesValidation,
  verifyShopAccess,
  getCreditSales
);

// Credit sales summary
router.get(
  "/:shopId/credit/summary",
  shopIdValidation,
  verifyShopAccess,
  getCreditSalesSummary
);

// Overdue credit sales
router.get(
  "/:shopId/credit/overdue",
  shopIdValidation,
  verifyShopAccess,
  getOverdueCreditSales
);

// Customer credit history
router.get(
  "/:shopId/credit/customer/:customerPhone",
  customerPhoneValidation,
  verifyShopAccess,
  getCustomerCreditHistory
);


// Get single sale
router.get(
  "/:shopId/sale/:saleId",
  shopIdValidation,
  saleIdValidation,
  verifyShopAccess,
  getSaleById
);

// Update sale (owner only)
router.put(
  "/:shopId/sale/:saleId",
  updateSaleValidation,
  verifyShopAccess,
  ownerOnly,
  updateSale
);

// Refund sale (owner only)
router.post(
  "/:shopId/sale/:saleId/refund",
  refundSaleValidation,
  verifyShopAccess,
  ownerOnly,
  refundSale
);

// Record credit payment
router.post(
  "/:shopId/sale/:saleId/payment",
  recordCreditPaymentValidation,
  verifyShopAccess,
  recordCreditPayment
);

// Delete sale (owner only)
router.delete(
  "/:shopId/sale/:saleId",
  shopIdValidation,
  saleIdValidation,
  verifyShopAccess,
  ownerOnly,
  deleteSale
);

export default router;