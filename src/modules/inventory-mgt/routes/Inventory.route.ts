import express from "express";
import {
  addProduct,
  getInventory,
  updateProduct,
  deleteProduct,
  stockIn,
  stockOut,
} from "../controllers/Inventory.Controller";
import { authenticate, ownerOnly } from "../../../shared/middleware/auth.middleware";

const router = express.Router();

router.post("/:shopId/products", authenticate, ownerOnly, addProduct);
router.get("/:shopId/inventory", authenticate, getInventory);
router.post("/:shopId/inventory/stock-in",  authenticate, stockIn);
router.post("/:shopId/inventory/stock-out",  authenticate, stockOut);
router.put("/:shopId/products/:productId", authenticate, ownerOnly, updateProduct);
router.delete("/:shopId/products/:productId", authenticate, ownerOnly, deleteProduct);
export default router;
