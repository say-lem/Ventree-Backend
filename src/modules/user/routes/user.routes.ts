import express from "express";
import {
  requestPasswordResetController,
  verifyPasswordResetOtpController,
  resetPasswordController,
  changePasswordController,
  getShopDashboardController,
} from "../controllers/user.controller";
import {
  requestPasswordResetValidation,
  verifyPasswordResetOtpValidation,
  resetPasswordValidation,
  changePasswordValidation,
  getShopDashboardValidation,
} from "../validators/user.validator";
import { authenticate, verifyShopAccess } from "../../../shared/middleware/auth.middleware";
import { validateRequest } from "../../expenses/middlewares/validateRequest.middleware";

const router = express.Router();

// Password reset routes (public)
router.post(
  "/password/reset/request",
  requestPasswordResetValidation,
  validateRequest,
  requestPasswordResetController
);

router.post(
  "/password/reset/verify-otp",
  verifyPasswordResetOtpValidation,
  validateRequest,
  verifyPasswordResetOtpController
);

router.post(
  "/password/reset",
  resetPasswordValidation,
  validateRequest,
  resetPasswordController
);

// Password change route (authenticated)
router.post(
  "/password/change",
  authenticate,
  changePasswordValidation,
  validateRequest,
  changePasswordController
);

// Get shop dashboard (authenticated)
router.get(
  "/shop/:shopId/dashboard",
  authenticate,
  getShopDashboardValidation,
  validateRequest,
  getShopDashboardController
);

export default router;

