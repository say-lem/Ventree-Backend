import { Document, Types } from "mongoose";

export interface ITicketItem {
  itemId: Types.ObjectId;
  itemName: string;
  itemCategory?: string;
  quantitySold: number;
  costPrice: number;
  sellingPrice: number;
  discount: number;
  lineTotal: number;
  lineProfit: number;
}

// Main ticket interface
export interface ITicket extends Document {
  _id: Types.ObjectId;
  ticketNumber: string; 
  shopId: Types.ObjectId;
  
  // Items sold in this ticket
  items: ITicketItem[];
  
  // Totals
  subtotal: number; // Sum of all line totals before tax
  taxAmount: number;
  totalAmount: number; // Final amount after tax
  totalProfit: number; // Sum of all line profits
  totalItemCount: number; // Total quantity of all items
  
  // Staff and payment info
  soldBy: Types.ObjectId;
  soldByName: string;
  paymentMethod: "cash" | "transfer" | "credit";
  transactionReference?: string;
  
  // Customer info (required for credit sales)
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  
  // Credit sale fields
  isCredit: boolean;
  creditStatus: "pending" | "partial" | "paid";
  amountPaid: number;
  amountOwed: number;
  dueDate?: Date;
  payments: ICreditPayment[];
  
  // Metadata
  notes?: string;
  date: Date;
  refunded: boolean;
  refundedAt?: Date;
  refundedBy?: Types.ObjectId;
  refundReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
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

// Input for creating a ticket
export interface CreateTicketInput {
  shopId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    discount?: number; // Per-item discount percentage
  }>;
  soldBy: string;
  paymentMethod: "cash" | "transfer" | "credit";
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  dueDate?: Date;
  notes?: string;
  transactionReference?: string;
}

// Query options for fetching tickets
export interface TicketQueryOptions {
  startDate?: Date;
  endDate?: Date;
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

// Ticket summary for list view
export interface ITicketSummary {
  _id: Types.ObjectId;
  ticketNumber: string;
  totalAmount: number;
  totalItemCount: number;
  soldByName: string;
  paymentMethod: string;
  date: Date;
  isCredit: boolean;
  creditStatus?: "pending" | "partial" | "paid";
  amountOwed?: number;
  refunded: boolean;
}

// Analytics
export interface TicketAnalytics {
  totalRevenue: number;
  totalProfit: number;
  totalItemsSold: number;
  totalTickets: number;
  averageTicketValue: number;
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
    ticketCount: number;
    revenue: number;
    profit: number;
  }>;
  dailySales?: Array<{
    date: string;
    revenue: number;
    tickets: number;
    itemsSold: number;
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

export interface RecordCreditPaymentInput {
  ticketId: string;
  shopId: string;
  amount: number;
  paymentMethod: "cash" | "transfer";
  receivedBy: string;
  transactionReference?: string;
  notes?: string;
}

export interface RefundTicketInput {
  reason: string;
  refundedBy: string;
}

export interface UpdateTicketInput {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  dueDate?: Date;
  notes?: string;
}