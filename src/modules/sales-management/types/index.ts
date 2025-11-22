import { Document, Types } from "mongoose";

export interface ISale extends Document {
  _id: Types.ObjectId;
  shopId: Types.ObjectId;
  itemId: Types.ObjectId;
  itemName: string;
  itemCategory?: string;
  quantitySold: number;
  costPrice: number; 
  sellingPrice: number;
  discount?: number;
  taxAmount?: number;
  totalAmount: number;
  profitAmount: number;
  soldBy: Types.ObjectId;
  soldByName: string;
  paymentMethod: "cash" | "transfer" | "credit";
  transactionReference?: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  isCredit: boolean;
  creditStatus: "pending" | "partial" | "paid";
  amountPaid: number;
  amountOwed: number;
  dueDate?: Date;
  payments: ICreditPayment[];
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
  paymentMethod: "cash" | "transfer" | "credit";
  discount?: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  dueDate?: Date;
  notes?: string;
  transactionReference?: string;
}

export interface UpdateSaleInput {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  dueDate?: Date;
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
  isCredit?: boolean;
  creditStatus?: "pending" | "partial" | "paid";
  customerPhone?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
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

export interface RecordCreditPaymentInput {
  saleId: string;
  shopId: string;
  amount: number;
  paymentMethod: "cash" | "transfer";
  receivedBy: string;  
  transactionReference?: string;
  notes?: string;
}

export interface ICreditPayment {
  amount: number;
  paymentMethod: "cash" | "transfer";
  paymentDate: Date;
  receivedBy: Types.ObjectId;
  receivedByName: string;
  transactionReference?: string;
  notes?: string;
}