import express from "express";
import {
  registerOwner,
  verifyOtp,
  loginUser,
  refreshToken,
  resendOTP,
} from "../controllers/auth.controller";
import {
  registerValidation,
  otpValidation,
  loginValidation,
  refreshTokenValidation,
  resendOtpValidation,
} from "../validators/auth.validator";

const router = express.Router();

router.post("/register", registerValidation, registerOwner);
router.post("/verify-otp", otpValidation, verifyOtp);
router.post("/login", loginValidation, loginUser);
router.post("/refresh", refreshTokenValidation, refreshToken);
router.post("/resend-otp", resendOtpValidation, resendOTP);

export default router;
