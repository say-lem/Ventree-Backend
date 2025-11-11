import express from "express";
import {
  addProduct,
  getInventory,
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

export default router;
