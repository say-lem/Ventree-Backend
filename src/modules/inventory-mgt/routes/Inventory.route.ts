import express from "express";
import {
  addProduct,
  getInventory,
  updateProduct,
  deleteProduct,
  stockIn,
  stockOut,
  filterProductsByName
} from "../controllers/Inventory.Controller";
import { authenticate, ownerOnly } from "../../../shared/middleware/auth.middleware";
import { verifyShopAccess } from "../middlewares/inventory.authorise";

const router = express.Router();

router.post("/:shopId/products", authenticate, ownerOnly, verifyShopAccess, addProduct);
router.get("/:shopId/inventory", authenticate, verifyShopAccess, getInventory);
router.post("/:shopId/inventory/stock-in",  authenticate, verifyShopAccess, stockIn);
router.post("/:shopId/inventory/stock-out",  authenticate, verifyShopAccess, stockOut);
router.put("/:shopId/products/:productId", authenticate, ownerOnly, verifyShopAccess, updateProduct);
router.delete("/:shopId/products/:productId", authenticate, ownerOnly, verifyShopAccess, deleteProduct);
router.get("/:shopId/inventory/search", authenticate, verifyShopAccess, filterProductsByName);

export default router;
