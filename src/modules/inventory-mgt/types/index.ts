import { Document, Types } from "mongoose";

export interface IInventoryItem extends Document {
  _id: Types.ObjectId;
  shopId: Types.ObjectId;
  name: string;
  description?: string;
  category: string;
  subCategory?: string;
  sku: string; // Stock Keeping Unit
  barcode?: string;
  costPrice: number;
  sellingPrice: number;
  minSellingPrice?: number;
  initialQuantity: number;
  availableQuantity: number;
  soldQuantity: number;
  damagedQuantity: number;
  returnedQuantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  unit: string;
  supplier?: {
    name: string;
    contact?: string;
    email?: string;
  };
  expiryDate?: Date;
  manufacturingDate?: Date;
  location?: string;
  images?: string[];
  tags?: string[];
  isActive: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  lastRestocked?: Date;
  lastSold?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInventoryInput {
  shopId: string;
  name: string;
  description?: string;
  category: string;
  subCategory?: string;
  sku?: string;
  barcode?: string;
  costPrice: number;
  sellingPrice: number;
  minSellingPrice?: number;
  initialQuantity: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  unit: string;
  supplier?: {
    name: string;
    contact?: string;
    email?: string;
  };
  expiryDate?: Date;
  manufacturingDate?: Date;
  location?: string;
  images?: string[];
  tags?: string[];
}

export interface UpdateInventoryInput {
  name?: string;
  description?: string;
  category?: string;
  subCategory?: string;
  barcode?: string;
  costPrice?: number;
  sellingPrice?: number;
  minSellingPrice?: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  unit?: string;
  supplier?: {
    name: string;
    contact?: string;
    email?: string;
  };
  expiryDate?: Date;
  manufacturingDate?: Date;
  location?: string;
  images?: string[];
  tags?: string[];
  isActive?: boolean;
}

export interface RestockInput {
  quantity: number;
  costPrice?: number;
  notes?: string;
}

export interface AdjustStockInput {
  quantity: number;
  reason: "damaged" | "expired" | "lost" | "found" | "returned" | "correction";
  notes?: string;
}

export interface InventoryQueryOptions {
  category?: string;
  subCategory?: string;
  isActive?: boolean;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
  search?: string;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "sellingPrice" | "availableQuantity" | "soldQuantity";
  sortOrder?: "asc" | "desc";
}

export interface InventoryAnalytics {
  totalItems: number;
  totalValue: number;
  totalRetailValue: number;
  potentialProfit: number;
  lowStockItems: number;
  outOfStockItems: number;
  expiringItems: number;
  topSellingItems: Array<{
    itemId: string;
    name: string;
    soldQuantity: number;
    revenue: number;
  }>;
  slowMovingItems: Array<{
    itemId: string;
    name: string;
    availableQuantity: number;
    lastSold?: Date;
  }>;
  categoryBreakdown: Array<{
    category: string;
    itemCount: number;
    totalValue: number;
  }>;
  stockTurnoverRate?: number;
}

export interface StockMovement {
  itemId: Types.ObjectId;
  itemName: string;
  type: "sale" | "restock" | "adjustment" | "damage" | "return";
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  reason?: string;
  notes?: string;
  performedBy: Types.ObjectId;
  performedByName: string;
  date: Date;
}

export interface RequestMetadata {
  ip: string;
  requestId: string;
  userId: string;
  userRole: "owner" | "staff";
  userShopId: string;
}