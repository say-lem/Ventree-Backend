import { Inventory } from "../models/Inventory";
import { AppError, NotFoundError } from "../../../shared/utils/AppError";

interface AddProductData {
  shopId: string;
  uploader: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  unit: string;
  quantity?: number;
  lowStockAt?: number;
}

interface StockUpdateData {
  shopId: string;
  productId: string;
  quantity: number;
}


  // Add a new product to inventory
 export const addProduct = async (data: AddProductData) => {
    const { shopId, uploader, name, costPrice, sellingPrice, unit, quantity, lowStockAt } = data;

    // Check if product with same name already exists for this shop
    const existingProduct = await Inventory.findOne({  name: { $regex: new RegExp(`^${name}$`, 'i') }  });

    if (existingProduct) {
      throw new AppError("Product with this name already exists in the inventory", 400);
    }

    const product = await Inventory.create({
      shopId,
      uploader,
      name,
      costPrice,
      sellingPrice,
      unit,
      quantity: quantity || 0,
      lowStockAt: lowStockAt || 5,
    });

    return product;
  }


  //update a product in inventory
  export const updateProduct = async (shopId: string, productId: string, updateData: Partial<AddProductData>) => {
    
    const product = await Inventory.findOneAndUpdate(
      { _id: productId, shopId },
      { $set: updateData },
      { new: true }
    );

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return product;
  }

  // Delete a product from inventory
  export const deleteProduct = async (shopId: string, productId: string) => {
    const product = await Inventory.findOneAndDelete({ _id: productId, shopId });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return product;
  }

  // Get all inventory for a shop
 export const getInventory = async (shopId: string) => {
    const inventory = await Inventory.find({ shopId });
    return inventory;
  }

  // Increase stock quantity
  export const stockIn = async (data: StockUpdateData) => {
    const { shopId, productId, quantity } = data;

    const product = await Inventory.findOne({ _id: productId, shopId });
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    product.quantity += quantity;
    await product.save();

    return product;
  }

  // Decrease stock quantity (triggered by sales)
 export const stockOut = async (data: StockUpdateData) => {
    const { shopId, productId, quantity } = data;

    const product = await Inventory.findOne({ _id: productId, shopId });
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.quantity < quantity) {
      throw new AppError("Not enough stock available", 400);
    }

    product.quantity -= quantity;
    await product.save();

    return product;
  }

  // Get all products that are low in stock for a shop
  export const getLowStockProducts = async (shopId: string) =>{
    const lowStockProducts = await Inventory.find({ 
      shopId,
      $expr: { $lte: ["$quantity", "$lowStockAt"] }
    }).sort({ quantity: 1 }); 

    return lowStockProducts;
  }