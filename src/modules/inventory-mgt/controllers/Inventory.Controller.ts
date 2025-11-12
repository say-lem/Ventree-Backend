import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { AuthorizationError, ValidationError } from "../../../shared/utils/AppError";
import * as InventoryService from "../services/Inventory.Service";

// Add a new product to inventory
export const addProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId } = req.params;
  const { name, costPrice, sellingPrice, unit, quantity, lowStockAt } = req.body;
  const userId = req.user?.profileId;


  // Authorization check
  if (req.user?.role !== "owner") {
    throw new AuthorizationError("Only shop owners can add products");
  }

  // Validation
  if (!name || !costPrice || !sellingPrice || !unit) {
    throw new ValidationError("Missing required product fields");
  }

  // Call service
  const product = await InventoryService.addProduct({
    shopId,
    uploader: userId!,
    name,
    costPrice,
    sellingPrice,
    unit,
    quantity,
    lowStockAt,
  });

  res.status(201).json({
    success: true,
    message: "Product added successfully",
    data: product,
  });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId, productId } = req.params;
  const updateData = req.body;

  // Call service
  const updatedProduct = await InventoryService.updateProduct(shopId, productId, updateData);

  res.status(200).json({
    success: true,
    message: "Product updated successfully",
    data: updatedProduct,
  });
});

//delete a product from inventory
export const deleteProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId, productId } = req.params;

  // Call service to delete product
  await InventoryService.deleteProduct(shopId, productId);

  res.status(200).json({
    success: true,
    message: "Product deleted successfully",
  });
});

// Get all inventory for a shop
export const getInventory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId } = req.params;

  const inventory = await InventoryService.getInventory(shopId);

  res.status(200).json({
    success: true,
    data: inventory,
  });
});

// Increase stock quantity
export const stockIn = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId } = req.params;
  const { productId, quantity } = req.body;

  // Validation
  if (!productId || !quantity) {
    throw new ValidationError("Product ID and quantity are required");
  }

  const product = await InventoryService.stockIn({
    shopId,
    productId,
    quantity,
  });

  res.status(200).json({
    success: true,
    message: "Stock updated successfully (stock-in)",
    data: product,
  });
});

// Decrease stock quantity (triggered by sales)
export const stockOut = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId } = req.params;
  const { productId, quantity } = req.body;

  // Validation
  if (!productId || !quantity) {
    throw new ValidationError("Product ID and quantity are required");
  }

  const product = await InventoryService.stockOut({
    shopId,
    productId,
    quantity,
  });

  res.status(200).json({
    success: true,
    message: "Stock updated successfully (stock-out)",
    data: product,
  });
});

// Get all products that are low in stock
export const getLowStockProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId } = req.params;

  const lowStockProducts = await InventoryService.getLowStockProducts(shopId);

  res.status(200).json({
    success: true,
    message: lowStockProducts.length > 0 
      ? `Found ${lowStockProducts.length} product(s) with low stock` 
      : "No products are currently low in stock",
    count: lowStockProducts.length,
    data: lowStockProducts,
  });
});