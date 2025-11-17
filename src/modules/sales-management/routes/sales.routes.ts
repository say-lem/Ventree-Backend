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
} from "../controllers/sales.controller";
import {
  recordSaleValidation,
  updateSaleValidation,
  refundSaleValidation,
  shopIdValidation,
  saleIdValidation,
  getSalesValidation,
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

// Record new sale (both owner and staff can record sales)
router.post("/", recordSaleValidation, recordSale);

// Get sales list with filters
router.get("/:shopId", getSalesValidation, verifyShopAccess, getSalesList);

// Get sales analytics (owner and staff)
router.get(
  "/:shopId/analytics",
  analyticsValidation,
  verifyShopAccess,
  requireRole("owner", "staff"),
  getSalesAnalytics
);

// Generate sales report (owner only)
router.get(
  "/:shopId/report",
  shopIdValidation,
  verifyShopAccess,
  ownerOnly,
  generateSalesReport
);

// Search sales
router.get(
  "/:shopId/search",
  searchSalesValidation,
  verifyShopAccess,
  searchSales
);

// Get top performing items
router.get(
  "/:shopId/top-items",
  shopIdValidation,
  verifyShopAccess,
  getTopPerformingItems
);

// Get staff performance
router.get(
  "/:shopId/staff-performance",
  shopIdValidation,
  verifyShopAccess,
  ownerOnly,
  getStaffPerformance
);

// Get single sale by ID
router.get(
  "/:shopId/:saleId",
  shopIdValidation,
  saleIdValidation,
  verifyShopAccess,
  getSaleById
);

// Update sale (owner only)
router.put(
  "/:shopId/:saleId",
  updateSaleValidation,
  verifyShopAccess,
  ownerOnly,
  updateSale
);

// Refund sale (owner only)
router.post(
  "/:shopId/:saleId/refund",
  refundSaleValidation,
  verifyShopAccess,
  ownerOnly,
  refundSale
);

// Delete sale (owner only)
router.delete(
  "/:shopId/:saleId",
  shopIdValidation,
  saleIdValidation,
  verifyShopAccess,
  ownerOnly,
  deleteSale
);

export default router;