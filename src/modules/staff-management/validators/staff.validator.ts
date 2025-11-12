import { body, param, query } from "express-validator";

export const createStaffValidation = [
  body("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  body("staffName")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Staff name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage("Staff name can only contain letters, spaces, hyphens, and apostrophes"),
  body("phoneNumber")
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Invalid phone number format. Use international format (e.g., +1234567890)"),
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)"
    ),
  body("role")
    .optional()
    .isIn(["cashier", "manager", "inventory", "staff"])
    .withMessage("Invalid role. Must be one of: cashier, manager, inventory, staff"),
];

export const updateStaffValidation = [
  param("staffId")
    .trim()
    .notEmpty()
    .withMessage("Staff ID is required")
    .isMongoId()
    .withMessage("Invalid staff ID format"),
  body("staffName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Staff name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage("Staff name can only contain letters, spaces, hyphens, and apostrophes"),
  body("phoneNumber")
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Invalid phone number format"),
  body("password")
    .optional()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "Password must contain uppercase, lowercase, number, and special character"
    ),
  body("role")
    .optional()
    .isIn(["cashier", "manager", "inventory", "staff"])
    .withMessage("Invalid role"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

export const staffIdValidation = [
  param("staffId")
    .trim()
    .notEmpty()
    .withMessage("Staff ID is required")
    .isMongoId()
    .withMessage("Invalid staff ID format"),
];

export const shopIdValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
];

export const listStaffValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean"),
  query("role")
    .optional()
    .isIn(["cashier", "manager", "inventory", "staff"])
    .withMessage("Invalid role filter"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];