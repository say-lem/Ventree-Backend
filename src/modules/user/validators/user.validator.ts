import { body, param, query } from "express-validator";

export const requestPasswordResetValidation = [
  body("shopName")
    .trim()
    .notEmpty()
    .withMessage("Shop name is required"),
  body("phoneNumber")
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Phone number must be a valid international format (10-15 digits)"),
];

export const verifyPasswordResetOtpValidation = [
  body("shopName")
    .trim()
    .notEmpty()
    .withMessage("Shop name is required"),
  body("phoneNumber")
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Phone number must be a valid international format (10-15 digits)"),
  body("otp")
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be exactly 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),
];

export const resetPasswordValidation = [
  body("resetToken")
    .trim()
    .notEmpty()
    .withMessage("Reset token is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)"
    ),
];

export const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)"
    ),
];

export const getShopDashboardValidation = [
  param("shopId")
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  query("period")
    .optional()
    .isIn(["today", "week"])
    .withMessage("Period must be 'today' or 'week'"),
];

