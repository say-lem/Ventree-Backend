import { Response } from "express";
import { validationResult } from "express-validator";
import { InventoryService } from "../services/Inventory.Service";
import { AuthenticatedRequest } from "../../../shared/middleware/auth.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { ValidationError, AuthenticationError } from "../../../shared/utils/AppError";
import crypto from "crypto";

const inventoryService = new InventoryService();

/**
 * @route POST /inventory/:shopId/items
 * @desc Create new inventory item
 */
export const createItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;
  const itemData = req.body;

  const item = await inventoryService.createItem(
    { ...itemData, shopId },
    {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.id,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    }
  );

  res.status(201).json({
    success: true,
    message: "Inventory item created successfully",
    data: item,
  });
});

/**
 * @route GET /inventory/:shopId/items
 * @desc Get inventory list with filters
 */
export const getInventoryList = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;
  const {
    category,
    subCategory,
    isActive = "true",
    isLowStock,
    isOutOfStock,
    search,
    tags,
    minPrice,
    maxPrice,
    page = "1",
    limit = "20",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const result = await inventoryService.getInventoryList(
    shopId,
    {
      category: category as string | undefined,
      subCategory: subCategory as string | undefined,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      isLowStock: isLowStock !== undefined ? isLowStock === "true" : undefined,
      isOutOfStock: isOutOfStock !== undefined ? isOutOfStock === "true" : undefined,
      search: search as string | undefined,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) as string[] : undefined,
      minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as any,
      sortOrder: sortOrder as "asc" | "desc",
    },
    {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.id,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    }
  );

  res.status(200).json({
    success: true,
    message: "Inventory retrieved successfully",
    data: result,
  });
});

/**
 * @route GET /inventory/:shopId/items/:itemId
 * @desc Get single inventory item
 */
export const getItemById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, itemId } = req.params;

  const item = await inventoryService.getItemById(itemId, shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.id,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Item retrieved successfully",
    data: item,
  });
});

/**
 * @route PUT /inventory/:shopId/items/:itemId
 * @desc Update inventory item
 */
export const updateItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, itemId } = req.params;
  const updates = req.body;

  const item = await inventoryService.updateItem(itemId, shopId, updates, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.id,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Item updated successfully",
    data: item,
  });
});

/**
 * @route DELETE /inventory/:shopId/items/:itemId
 * @desc Delete inventory item
 */
export const deleteItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, itemId } = req.params;

  await inventoryService.deleteItem(itemId, shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.id,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Item deleted successfully",
  });
});

/**
 * @route POST /inventory/:shopId/items/:itemId/restock
 * @desc Restock inventory item
 */
export const restockItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, itemId } = req.params;
  const { quantity, costPrice, notes } = req.body;

  const item = await inventoryService.restockItem(
    itemId,
    shopId,
    { quantity, costPrice, notes },
    {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.id,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    }
  );

  res.status(200).json({
    success: true,
    message: "Item restocked successfully",
    data: item,
  });
});

/**
 * @route POST /inventory/:shopId/items/:itemId/adjust
 * @desc Adjust stock (damages, corrections, etc.)
 */
export const adjustStock = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, itemId } = req.params;
  const { quantity, reason, notes } = req.body;

  const item = await inventoryService.adjustStock(
    itemId,
    shopId,
    { quantity, reason, notes },
    {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.id,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    }
  );

  res.status(200).json({
    success: true,
    message: "Stock adjusted successfully",
    data: item,
  });
});

/**
 * @route GET /inventory/:shopId/low-stock
 * @desc Get low stock items
 */
export const getLowStockItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;

  const items = await inventoryService.getLowStockItems(shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.id,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: items.length > 0 
      ? `Found ${items.length} low stock items` 
      : "No low stock items",
    count: items.length,
    data: items,
  });
});

/**
 * @route GET /inventory/:shopId/out-of-stock
 * @desc Get out of stock items
 */
export const getOutOfStockItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;

  const items = await inventoryService.getOutOfStockItems(shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.id,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: items.length > 0 
      ? `Found ${items.length} out of stock items` 
      : "No out of stock items",
    count: items.length,
    data: items,
  });
});

/**
 * @route GET /inventory/:shopId/expiring
 * @desc Get expiring items
 */
export const getExpiringItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;
  const { days = "30" } = req.query;

  const items = await inventoryService.getExpiringItems(
    shopId,
    parseInt(days as string),
    {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.id,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    }
  );

  res.status(200).json({
    success: true,
    message: items.length > 0 
      ? `Found ${items.length} items expiring in ${days} days` 
      : `No items expiring in ${days} days`,
    count: items.length,
    data: items,
  });
});

/**
 * @route GET /inventory/:shopId/analytics
 * @desc Get inventory analytics
 */
export const getAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;

  const analytics = await inventoryService.getAnalytics(shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.id,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Analytics retrieved successfully",
    data: analytics,
  });
});

/**
 * @route GET /inventory/:shopId/categories
 * @desc Get all categories with item counts
 */
export const getCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;

  const categories = await inventoryService.getCategories(shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.id,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Categories retrieved successfully",
    data: categories,
  });
});

/**
 * @route GET /inventory/:shopId/items/:itemId/movements
 * @desc Get stock movements for an item
 */
export const getStockMovements = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, itemId } = req.params;
  const { page = "1", limit = "20" } = req.query;

  const result = await inventoryService.getStockMovements(
    itemId,
    shopId,
    parseInt(page as string),
    parseInt(limit as string),
    {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.id,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    }
  );

  res.status(200).json({
    success: true,
    message: "Stock movements retrieved successfully",
    data: result,
  });
});