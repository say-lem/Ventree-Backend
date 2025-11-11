import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { Inventory } from "../models/Inventory";
import { AppError, AuthorizationError, ValidationError, NotFoundError } from "../../../shared/utils/AppError";

//Add a new product to inventory
export const addProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId } = req.params;
  const { name, costPrice, sellingPrice, unit, quantity, lowStockAt } = req.body;
  const userId = req.user?.id; 

  if (req.user?.role !== "owner") {
    throw new AuthorizationError("Only shop owners can add products");
  }

  if (!name || !costPrice || !sellingPrice || !unit)
    throw new ValidationError("Missing required product fields");

  const product = await Inventory.create({
    shopId,
    uploader: userId,
    name,
    costPrice,
    sellingPrice,
    unit,
    quantity: quantity || 0,
    lowStockAt: lowStockAt || 5,
  });

  res.status(201).json({
    success: true,
    message: "Product added successfully",
    data: product,
  });
});

//Get all inventory for a shop
export const getInventory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId } = req.params;

  const inventory = await Inventory.find({ shopId });

  res.status(200).json({
    success: true,
    data: inventory,
  });
});

//Increase stock quantity
export const stockIn = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId } = req.params;
  const { productId, quantity } = req.body;

  if (!productId || !quantity)
    throw new ValidationError("Product ID and quantity are required");

  const product = await Inventory.findOne({ _id: productId, shopId });
  if (!product) throw new NotFoundError("Product not found");

  product.quantity += quantity;
  await product.save();

  res.status(200).json({
    success: true,
    message: "Stock updated successfully (stock-in)",
    data: product,
  });
});

//Decrease stock quantity (triggered by sales)
export const stockOut = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { shopId } = req.params;
  const { productId, quantity } = req.body;

  if (!productId || !quantity)
    throw new ValidationError("Product ID and quantity are required");

  const product = await Inventory.findOne({ _id: productId, shopId });
  if (!product) throw new NotFoundError("Product not found");

  if (product.quantity < quantity)
    throw new AppError("Not enough stock available", 400);

  product.quantity -= quantity;
  await product.save();

  res.status(200).json({
    success: true,
    message: "Stock updated successfully (stock-out)",
    data: product,
  });
});