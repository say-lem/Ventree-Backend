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
