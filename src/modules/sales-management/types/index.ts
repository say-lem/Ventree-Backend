import { Document, Types } from "mongoose";

export interface ISale extends Document {
  _id: Types.ObjectId;
  shopId: Types.ObjectId;
  itemId: Types.ObjectId;
  itemName: string;
  itemCategory?: string;
  quantitySold: number;
  costPrice: number; // For profit calculation
  sellingPrice: number;
  discount?: number;
  taxAmount?: number;
  totalAmount: number;
  profitAmount: number;
  soldBy: Types.ObjectId; // Reference to Staff
  soldByName: string;
  paymentMethod: "cash" | "card" | "mobile" | "bank_transfer";
  transactionReference?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  date: Date;
  refunded: boolean;
  refundedAt?: Date;
  refundedBy?: Types.ObjectId;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordSaleInput {
  shopId: string;
  itemId: string;
  quantity: number;
  soldBy: string;
  paymentMethod: "cash" | "card" | "mobile" | "bank_transfer";
  discount?: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  transactionReference?: string;
}

export interface UpdateSaleInput {
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}

export interface RefundSaleInput {
  reason: string;
  refundedBy: string;
}

export interface SalesQueryOptions {
  startDate?: Date;
  endDate?: Date;
  itemId?: string;
  soldBy?: string;
  paymentMethod?: string;
  includeRefunded?: boolean;
  page?: number;
  limit?: number;
  sortBy?: "date" | "totalAmount" | "quantitySold";
  sortOrder?: "asc" | "desc";
}

export interface SalesAnalytics {
  totalRevenue: number;
  totalProfit: number;
  totalItemsSold: number;
  totalTransactions: number;
  averageTransactionValue: number;
  averageProfit: number;
  topSellingItems: Array<{
    itemId: string;
    itemName: string;
    quantitySold: number;
    revenue: number;
  }>;
  salesByPaymentMethod: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  salesByStaff: Array<{
    staffId: string;
    staffName: string;
    salesCount: number;
    revenue: number;
  }>;
  dailySales?: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
  refundedAmount?: number;
  refundedCount?: number;
}

export interface RequestMetadata {
  ip: string;
  requestId: string;
  userId: string;
  userRole: "owner" | "staff";
  userShopId: string;
}


export interface InventoryItem {
  _id: string;
  name: string;
  sku?: string;
  availableQuantity: number;
  costPrice: number;
  sellingPrice: number;
}


