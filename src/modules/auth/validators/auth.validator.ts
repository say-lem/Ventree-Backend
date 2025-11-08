import { body } from "express-validator";

export const registerValidation = [
  body("shopName")
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Shop name must be between 3 and 100 characters"),
  body("phoneNumber")
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Phone number must be a valid international format (10-15 digits)"),
  body("ownerName")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Owner name must be between 2 and 100 characters"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)"
    ),
];

export const otpValidation = [
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

export const loginValidation = [
  body("shopName")
    .trim()
    .notEmpty()
    .withMessage("Shop name is required"),
  body("phoneNumber")
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Phone number must be a valid international format (10-15 digits)"),
  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

export const refreshTokenValidation = [
  body("refreshToken")
    .notEmpty()
    .withMessage("Refresh token is required")
    .isString()
    .withMessage("Refresh token must be a string"),
];

export const resendOtpValidation = [
  body("shopName")
    .trim()
    .notEmpty()
    .withMessage("Shop name is required"),
  body("phoneNumber")
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Phone number must be a valid international format (10-15 digits)"),
];
