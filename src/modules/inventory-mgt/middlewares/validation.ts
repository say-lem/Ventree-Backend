import { body, param, query } from "express-validator";

export const createItemValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  body("name")
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Item name must be between 2 and 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters"),
  body("subCategory")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Sub-category cannot exceed 50 characters"),
  body("sku")
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("SKU must be between 3 and 50 characters")
    .matches(/^[A-Z0-9\-]+$/)
    .withMessage("SKU can only contain uppercase letters, numbers, and hyphens"),
  body("barcode")
    .optional()
    .trim()
    .isLength({ min: 8, max: 13 })
    .withMessage("Barcode must be between 8 and 13 characters")
    .isNumeric()
    .withMessage("Barcode must contain only numbers"),
  body("costPrice")
    .isFloat({ min: 0 })
    .withMessage("Cost price must be a positive number"),
  body("sellingPrice")
    .isFloat({ min: 0 })
    .withMessage("Selling price must be a positive number"),
  body("minSellingPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum selling price must be a positive number"),
  body("initialQuantity")
    .isInt({ min: 0 })
    .withMessage("Initial quantity must be a non-negative integer"),
  body("reorderLevel")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Reorder level must be a non-negative integer"),
  body("reorderQuantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Reorder quantity must be a non-negative integer"),
  body("unit")
    .trim()
    .notEmpty()
    .withMessage("Unit is required")
    .isIn([
      "pieces",
      "kg",
      "g",
      "liters",
      "ml",
      "boxes",
      "packs",
      "dozens",
      "cartons",
      "bags",
      "bottles",
      "cans",
      "meters",
      "cm",
    ])
    .withMessage("Invalid unit"),
  body("supplier.name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Supplier name cannot exceed 100 characters"),
  body("supplier.contact")
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Invalid supplier contact number"),
  body("supplier.email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Invalid supplier email address"),
  body("expiryDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid expiry date format"),
  body("manufacturingDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid manufacturing date format"),
  body("location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot exceed 100 characters"),
  body("images")
    .optional()
    .isArray()
    .withMessage("Images must be an array"),
  body("images.*")
    .optional()
    .isURL()
    .withMessage("Each image must be a valid URL"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
  body("tags.*")
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage("Each tag cannot exceed 30 characters"),
];

export const updateItemValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  param("itemId")
    .trim()
    .notEmpty()
    .withMessage("Item ID is required")
    .isMongoId()
    .withMessage("Invalid item ID format"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Item name must be between 2 and 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
  body("category")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters"),
  body("subCategory")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Sub-category cannot exceed 50 characters"),
  body("barcode")
    .optional()
    .trim()
    .isLength({ min: 8, max: 13 })
    .withMessage("Barcode must be between 8 and 13 characters")
    .isNumeric()
    .withMessage("Barcode must contain only numbers"),
  body("costPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Cost price must be a positive number"),
  body("sellingPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Selling price must be a positive number"),
  body("minSellingPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum selling price must be a positive number"),
  body("reorderLevel")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Reorder level must be a non-negative integer"),
  body("reorderQuantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Reorder quantity must be a non-negative integer"),
  body("unit")
    .optional()
    .trim()
    .isIn([
      "pieces",
      "kg",
      "g",
      "liters",
      "ml",
      "boxes",
      "packs",
      "dozens",
      "cartons",
      "bags",
      "bottles",
      "cans",
      "meters",
      "cm",
    ])
    .withMessage("Invalid unit"),
  body("supplier.name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Supplier name cannot exceed 100 characters"),
  body("supplier.contact")
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage("Invalid supplier contact number"),
  body("supplier.email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Invalid supplier email address"),
  body("expiryDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid expiry date format"),
  body("manufacturingDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid manufacturing date format"),
  body("location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot exceed 100 characters"),
  body("images")
    .optional()
    .isArray()
    .withMessage("Images must be an array"),
  body("images.*")
    .optional()
    .isURL()
    .withMessage("Each image must be a valid URL"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
  body("tags.*")
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage("Each tag cannot exceed 30 characters"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const itemIdValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  param("itemId")
    .trim()
    .notEmpty()
    .withMessage("Item ID is required")
    .isMongoId()
    .withMessage("Invalid item ID format"),
];

export const shopIdValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
];

export const restockValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  param("itemId")
    .trim()
    .notEmpty()
    .withMessage("Item ID is required")
    .isMongoId()
    .withMessage("Invalid item ID format"),
  body("quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),
  body("costPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Cost price must be a positive number"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

export const adjustStockValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  param("itemId")
    .trim()
    .notEmpty()
    .withMessage("Item ID is required")
    .isMongoId()
    .withMessage("Invalid item ID format"),
  body("quantity")
    .isInt()
    .withMessage("Quantity must be an integer")
    .custom((value) => value !== 0)
    .withMessage("Quantity cannot be zero"),
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Reason is required")
    .isIn(["damaged", "expired", "lost", "found", "returned", "correction"])
    .withMessage("Invalid reason"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

export const getInventoryValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  query("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category filter too long"),
  query("subCategory")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Sub-category filter too long"),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
  query("isLowStock")
    .optional()
    .isBoolean()
    .withMessage("isLowStock must be boolean"),
  query("isOutOfStock")
    .optional()
    .isBoolean()
    .withMessage("isOutOfStock must be boolean"),
  query("search")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 2 and 100 characters"),
  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum price must be positive"),
  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum price must be positive"),
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
    .isIn(["name", "createdAt", "sellingPrice", "availableQuantity", "soldQuantity"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be asc or desc"),
];

export const getExpiringItemsValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  query("days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Days must be between 1 and 365"),
];

export const getStockMovementsValidation = [
  param("shopId")
    .trim()
    .notEmpty()
    .withMessage("Shop ID is required")
    .isMongoId()
    .withMessage("Invalid shop ID format"),
  param("itemId")
    .trim()
    .notEmpty()
    .withMessage("Item ID is required")
    .isMongoId()
    .withMessage("Invalid item ID format"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];