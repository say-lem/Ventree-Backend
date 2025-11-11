import express from "express";
import {
  addProduct,
  getInventory,
  updateProduct,
  deleteProduct,
  stockIn,
  stockOut,
} from "../controllers/Inventory.Controller";
//import { isAuthenticated } from "../middlewares/isAuthenticated"; 
import { fakeAuth } from "../middlewares/fakeAuth";

const router = express.Router();

router.post("/:shopId/products", fakeAuth, addProduct);
router.get("/:shopId/inventory", fakeAuth, getInventory);
router.post("/:shopId/inventory/stock-in", fakeAuth, stockIn);
router.post("/:shopId/inventory/stock-out", fakeAuth, stockOut);
router.put("/:shopId/products/:productId", fakeAuth, updateProduct);
router.delete("/:shopId/products/:productId", fakeAuth, deleteProduct);

export default router;
