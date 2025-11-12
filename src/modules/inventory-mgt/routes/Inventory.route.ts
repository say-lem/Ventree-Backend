import express from "express";
import {
  addProduct,
  getInventory,
  updateProduct,
  deleteProduct,
  stockIn,
  stockOut,
  getLowStockProducts
} from "../controllers/Inventory.Controller";
//import { isAuthenticated } from "../middlewares/isAuthenticated"; 
import { fakeAuth } from "../middlewares/fakeAuth";
import { authorize } from "../middlewares/authorize";

const router = express.Router();

router.post("/:shopId/products", fakeAuth, authorize("owner"), addProduct);
router.get("/:shopId/inventory", fakeAuth, authorize("owner", "staff"), getInventory);
router.post("/:shopId/inventory/stock-in",  fakeAuth, authorize("owner", "staff"), stockIn);
router.post("/:shopId/inventory/stock-out",  fakeAuth, authorize("owner", "staff"), stockOut);
router.put("/:shopId/products/:productId", fakeAuth, authorize("owner"), updateProduct);
router.delete("/:shopId/products/:productId", fakeAuth, authorize("owner"), deleteProduct);
router.get("/:shopId/inventory/low-stock", fakeAuth, authorize("owner", "staff"), getLowStockProducts);

export default router;
