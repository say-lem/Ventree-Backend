import { Router } from "express";
import { getShopProfile, updateShopProfile } from "../controllers/shop.controller";
import { submitKYC, updateKYC, getKYCStatus } from "../controllers/kyc.controller";
import { authenticate, ownerOnly, verifyShopAccess } from "../../../shared/middleware/auth.middleware";
import { validateShopId, validateUpdateShop } from "../middleware/shop.validation";
import { validateSubmitKYC, validateUpdateKYC } from "../middleware/kyc.validation";


const router = Router()

router.get(
  "/:shopId/profile",
  authenticate,        // Verifies JWT and sets req.user
  ownerOnly,          // Ensures role === "owner"
  verifyShopAccess,   // Ensures user.shopId === params.shopId
  validateShopId,     // Validates shopId format
  getShopProfile
);


// PATCH /shops/:shopId/profile - Update shop profile (owner only)
router.patch(
  "/:shopId/profile",
  authenticate,
  ownerOnly,
  verifyShopAccess,
  validateShopId,
  validateUpdateShop,
  updateShopProfile
);

// KYC Routes
router.post(
  "/:shopId/kyc/submit",
  authenticate,
  ownerOnly,
  verifyShopAccess,
  validateShopId,
  validateSubmitKYC,
  submitKYC
);

router.patch(
  "/:shopId/kyc/update",
  authenticate,
  ownerOnly,
  verifyShopAccess,
  validateShopId,
  validateUpdateKYC,
  updateKYC
);

router.get(
  "/:shopId/kyc/status",
  authenticate,
  ownerOnly,
  verifyShopAccess,
  validateShopId,
  getKYCStatus
);


export { router as shopRouter };