import { body, param, query } from "express-validator";

export const recordSaleValidation = [
  body("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  body("itemId")
    .trim()
    .notEmpty()
    .withMessage("Item ID is required")
    .isMongoId()
    .withMessage("Invalid item ID format"),
  body("quantity")
    .isInt({ min: 1, max: 10000 })
    .withMessage("Quantity must be between 1 and 10,000"),
  body("soldBy")
    .trim()
    .notEmpty()
    .withMessage("Sold by is required")
    .isMongoId()
    .withMessage("Invalid staff ID format"),
  body("paymentMethod")
    .trim()
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["cash", "card", "mobile", "bank_transfer"])
    .withMessage("Invalid payment method. Must be: cash, card, mobile, or bank_transfer"),
  body("discount")
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage("Discount must be between 0 and 50 percent"),
  body("customerName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Customer name must be between 2 and 100 characters"),
  body("customerPhone")
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Invalid phone number format"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
  body("transactionReference")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Transaction reference cannot exceed 100 characters"),
];

export const updateSaleValidation = [
  param("saleId")
    .trim()
    .notEmpty()
    .withMessage("Sale ID is required")
    .isMongoId()
    .withMessage("Invalid sale ID format"),
  body("customerName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Customer name must be between 2 and 100 characters"),
  body("customerPhone")
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Invalid phone number format"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

export const refundSaleValidation = [
  param("saleId")
    .trim()
    .notEmpty()
    .withMessage("Sale ID is required")
    .isMongoId()
    .withMessage("Invalid sale ID format"),
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Refund reason is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Refund reason must be between 10 and 500 characters"),
  body("refundedBy")
    .trim()
    .notEmpty()
    .withMessage("Refunded by is required")
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

export const saleIdValidation = [
  param("saleId")
    .trim()
    .notEmpty()
    .withMessage("Sale ID is required")
    .isMongoId()
    .withMessage("Invalid sale ID format"),
];

export const getSalesValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format. Use ISO 8601 format"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format. Use ISO 8601 format"),
  query("itemId")
    .optional()
    .isMongoId()
    .withMessage("Invalid item ID format"),
  query("soldBy")
    .optional()
    .isMongoId()
    .withMessage("Invalid staff ID format"),
  query("paymentMethod")
    .optional()
    .isIn(["cash", "card", "mobile", "bank_transfer"])
    .withMessage("Invalid payment method"),
  query("includeRefunded")
    .optional()
    .isBoolean()
    .withMessage("includeRefunded must be a boolean"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("sortBy")
    .optional()
    .isIn(["date", "totalAmount", "quantitySold"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be asc or desc"),
];

export const analyticsValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
  query("includeRefunded")
    .optional()
    .isBoolean()
    .withMessage("includeRefunded must be a boolean"),
];

export const searchSalesValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  query("q")
    .trim()
    .notEmpty()
    .withMessage("Search query is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Search query must be between 2 and 100 characters"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];