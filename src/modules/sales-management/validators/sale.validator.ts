import { body, param, query } from "express-validator";

// Create ticket validation
export const createTicketValidation = [
  body("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  
  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item is required"),
  
  body("items.*.itemId")
    .trim()
    .notEmpty()
    .withMessage("Item ID is required")
    .isMongoId()
    .withMessage("Invalid item ID format"),
  
  body("items.*.quantity")
    .isInt({ min: 1, max: 10000 })
    .withMessage("Quantity must be between 1 and 10,000"),
  
  body("items.*.discount")
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage("Discount must be between 0 and 50 percent"),
  
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
    .isIn(["cash", "transfer", "credit"])
    .withMessage("Invalid payment method. Must be: cash, transfer, or credit"),
  
  // Customer name - required for credit sales
  body("customerName")
    .if(body("paymentMethod").equals("credit"))
    .trim()
    .notEmpty()
    .withMessage("Customer name is required for credit sales")
    .isLength({ min: 2, max: 100 })
    .withMessage("Customer name must be between 2 and 100 characters"),
  body("customerName")
    .if(body("paymentMethod").not().equals("credit"))
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Customer name must be between 2 and 100 characters"),
  
  // Customer phone - required for credit sales
  body("customerPhone")
    .if(body("paymentMethod").equals("credit"))
    .trim()
    .notEmpty()
    .withMessage("Customer phone is required for credit sales")
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Invalid phone number format"),
  body("customerPhone")
    .if(body("paymentMethod").not().equals("credit"))
    .optional()
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Invalid phone number format"),
  
  body("customerAddress")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Customer address cannot exceed 500 characters"),
  
  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid due date format. Use ISO 8601 format")
    .custom((value) => {
      const dueDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        throw new Error("Due date cannot be in the past");
      }
      return true;
    }),
  
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

// Update ticket validation
export const updateTicketValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  param("ticketId")
    .trim()
    .notEmpty()
    .withMessage("Ticket ID is required")
    .isMongoId()
    .withMessage("Invalid ticket ID format"),
  body("customerName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Customer name must be between 2 and 100 characters"),
  body("customerPhone")
    .optional()
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Invalid phone number format"),
  body("customerAddress")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Customer address cannot exceed 500 characters"),
  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid due date format"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

// Refund ticket validation
export const refundTicketValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  param("ticketId")
    .trim()
    .notEmpty()
    .withMessage("Ticket ID is required")
    .isMongoId()
    .withMessage("Invalid ticket ID format"),
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

// Shop ID validation
export const shopIdValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
];

// Ticket ID validation
export const ticketIdValidation = [
  param("ticketId")
    .trim()
    .notEmpty()
    .withMessage("Ticket ID is required")
    .isMongoId()
    .withMessage("Invalid ticket ID format"),
];

// Get tickets list validation
export const getTicketsValidation = [
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
  query("soldBy")
    .optional()
    .isMongoId()
    .withMessage("Invalid staff ID format"),
  query("paymentMethod")
    .optional()
    .isIn(["cash", "transfer", "credit"])
    .withMessage("Invalid payment method"),
  query("includeRefunded")
    .optional()
    .isBoolean()
    .withMessage("includeRefunded must be a boolean"),
  query("isCredit")
    .optional()
    .isBoolean()
    .withMessage("isCredit must be a boolean"),
  query("creditStatus")
    .optional()
    .isIn(["pending", "partial", "paid"])
    .withMessage("Invalid credit status. Must be: pending, partial, or paid"),
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
    .isIn(["date", "totalAmount", "amountOwed", "dueDate"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be asc or desc"),
];

// Analytics validation
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

// Search tickets validation
export const searchTicketsValidation = [
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

// Record credit payment validation
export const recordCreditPaymentValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  param("ticketId")
    .trim()
    .notEmpty()
    .withMessage("Ticket ID is required")
    .isMongoId()
    .withMessage("Invalid ticket ID format"),
  body("amount")
    .notEmpty()
    .withMessage("Payment amount is required")
    .isFloat({ min: 0.01 })
    .withMessage("Payment amount must be greater than 0"),
  body("paymentMethod")
    .trim()
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["cash", "transfer"])
    .withMessage("Invalid payment method. Must be: cash or transfer"),
  body("receivedBy")
    .trim()
    .notEmpty()
    .withMessage("Received by is required")
    .isMongoId()
    .withMessage("Invalid staff ID format"),
  body("transactionReference")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Transaction reference cannot exceed 100 characters"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

// Get credit tickets validation
export const getCreditTicketsValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  query("creditStatus")
    .optional()
    .isIn(["pending", "partial", "paid"])
    .withMessage("Invalid credit status. Must be: pending, partial, or paid"),
  query("customerPhone")
    .optional()
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Invalid phone number format"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
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
    .isIn(["date", "totalAmount", "amountOwed", "dueDate", "customerName"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be asc or desc"),
];

// Customer phone validation
export const customerPhoneValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  param("customerPhone")
    .trim()
    .notEmpty()
    .withMessage("Customer phone is required")
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Invalid phone number format"),
];