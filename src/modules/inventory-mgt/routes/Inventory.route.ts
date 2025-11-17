import express from "express";
import {
  createItem,
  getInventoryList,
  getItemById,
  updateItem,
  deleteItem,
  restockItem,
  adjustStock,
  getLowStockItems,
  getOutOfStockItems,
  getExpiringItems,
  getAnalytics,
  getCategories,
  getStockMovements,
} from "../controllers/Inventory.Controller";
import {
  createItemValidation,
  updateItemValidation,
  itemIdValidation,
  shopIdValidation,
  restockValidation,
  adjustStockValidation,
  getInventoryValidation,
  getExpiringItemsValidation,
  getStockMovementsValidation,
} from "../middlewares/validation";
import {
  authenticate,
  ownerOnly,
  verifyShopAccess,
  requireRole,
} from "../../../shared/middleware/auth.middleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create new item (owner only)
router.post(
  "/:shopId/items",
  createItemValidation,
  verifyShopAccess,
  ownerOnly,
  createItem
);

// Get inventory list (both owner and staff)
router.get(
  "/:shopId/items",
  getInventoryValidation,
  verifyShopAccess,
  getInventoryList
);

// Get analytics (both owner and staff)
router.get(
  "/:shopId/analytics",
  shopIdValidation,
  verifyShopAccess,
  getAnalytics
);

// Get categories (both owner and staff)
router.get(
  "/:shopId/categories",
  shopIdValidation,
  verifyShopAccess,
  getCategories
);

// Get low stock items (both owner and staff)
router.get(
  "/:shopId/low-stock",
  shopIdValidation,
  verifyShopAccess,
  getLowStockItems
);

// Get out of stock items (both owner and staff)
router.get(
  "/:shopId/out-of-stock",
  shopIdValidation,
  verifyShopAccess,
  getOutOfStockItems
);

// Get expiring items (both owner and staff)
router.get(
  "/:shopId/expiring",
  getExpiringItemsValidation,
  verifyShopAccess,
  getExpiringItems
);

// Get single item (both owner and staff)
router.get(
  "/:shopId/items/:itemId",
  itemIdValidation,
  verifyShopAccess,
  getItemById
);

// Get stock movements for an item (both owner and staff)
router.get(
  "/:shopId/items/:itemId/movements",
  getStockMovementsValidation,
  verifyShopAccess,
  getStockMovements
);

// Restock item (both owner and staff)
router.post(
  "/:shopId/items/:itemId/restock",
  restockValidation,
  verifyShopAccess,
  restockItem
);

// Adjust stock (both owner and staff)
router.post(
  "/:shopId/items/:itemId/adjust",
  adjustStockValidation,
  verifyShopAccess,
  adjustStock
);

// Update item (owner only)
router.put(
  "/:shopId/items/:itemId",
  updateItemValidation,
  verifyShopAccess,
  ownerOnly,
  updateItem
);

// Delete item (owner only)
router.delete(
  "/:shopId/items/:itemId",
  itemIdValidation,
  verifyShopAccess,
  ownerOnly,
  deleteItem
);

export default router;