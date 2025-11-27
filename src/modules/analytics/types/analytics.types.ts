export interface AnalyticsContext {
  requestId: string;
  ip: string;
  userId: string;
  userRole: "owner" | "staff";
  userShopId: string;
}

export interface DashboardOverview {
  date: string;
  totalSales: number;
  totalCogs: number;
  totalExpenses: number;
  profit: number;
  lowStockAlertCount: number;
  totalTransactions: number;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
}

export interface BestSeller {
  itemId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
  contribution: number;
}

export type LowStockStatus = "Critical" | "Low";

export interface LowStockAlert {
  itemId: string;
  productName: string;
  currentStock: number;
  status: LowStockStatus;
  reorderLevel: number;
  unit: string;
}

export interface ExpensesBreakdownSlice {
  category: string;
  total: number;
  percentage: number;
}

export interface ProfitSummaryRow {
  label: string;
  startDate: string;
  endDate: string;
  revenue: number;
  cogs: number;
  expenses: number;
  profit: number;
}

export interface BestSellersFilters {
  limit: number;
  startDate?: Date;
  endDate?: Date;
}

export interface DateRangeFilters {
  startDate?: Date;
  endDate?: Date;
}

export type ProfitPeriod = "weekly" | "monthly";
