import { body, param, query } from "express-validator";

export const expensesCreateValidation = [
  body("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID"),

  // staffId logic: optional for owner, required for staff
  body("staffId").custom((value, { req }) => {
    const role = req.user?.role; // from your authenticate middleware

    if (role === "owner") {
      // owner does NOT need staffId
      return true;
    }

    // staff user → staffId MUST be provided
    if (!value) {
      throw new Error("Staff ID is required for staff users");
    }

    // must be a valid MongoId
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      throw new Error("Invalid staff ID");
    }

    return true;
  }),

  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isNumeric()
    .withMessage("Amount must be a number"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Expense title is required")
    .isString()
    .withMessage("Title must be a string"),

  body("category")
    .trim()
    .notEmpty()
    .withMessage("Expense Category is required")
    .isString()
    .withMessage("Category must be a string"),

  body("notes")
    .optional()
    .isString()
    .withMessage("Notes must be a string")
];


export const expensesUpdateValidation = [
  // body("shopId")
  //   .trim()
  //   .notEmpty()
  //   .withMessage("Shop ID is required")
  //   .isMongoId(),

  // staffId logic: optional for owner, required for staff
  body("staffId").custom((value, { req }) => {
    const role = req.user?.role; // from your authenticate middleware

    if (role === "owner") {
      // owner does NOT need staffId
      return true;
    }

    // staff user → staffId MUST be provided
    if (!value) {
      throw new Error("Staff ID is required for staff users");
    }

    // must be a valid MongoId
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      throw new Error("Invalid staff ID");
    }

    return true;
  }),

  body("expenseId")
    .trim()
    .notEmpty()
    .withMessage("Expense ID is required")
    .isMongoId(),

  body("updateData")
    .notEmpty()
    .withMessage("updateData is required")
];


export const expensesDeleteValidation = [
  param("expenseId")
    .trim()
    .notEmpty()
    .withMessage("Expense ID is required")
    .isMongoId(),

  body("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId(),

  body("staffId")
    .trim()
    .notEmpty()
    .withMessage("Staff ID is required")
    .isMongoId()
];


export const shopIdParamValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
];


export const filterExpensesValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId(),

  query("filter")
    .trim()
    .notEmpty()
    .withMessage("Filter is required")
    .isIn(["today", "week", "month"])
    .withMessage("Filter must be today, week or month")
];

// ============================================
// CHANGES TO: validators/expenses.validator.ts
// ============================================

// ... (keep all existing validations)

// ✅ ADD THIS NEW VALIDATION for GET expenses with filters/pagination
export const getExpensesValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID"),

  // Pagination
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  // Filters
  query("category")
    .optional()
    .trim()
    .isString()
    .withMessage("Category must be a string"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO8601 date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO8601 date"),

  query("minAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum amount must be a positive number"),

  query("maxAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum amount must be a positive number"),

  query("search")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Search term must be between 2 and 100 characters"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "amount", "title"])
    .withMessage("Sort by must be createdAt, amount, or title"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be asc or desc"),
];

// Keep all other existing validations...