import { TicketRepository } from "../../sales-management/repositories/sales.repository";
import { InventoryRepository } from "../../inventory-mgt/repository/inventory.repository";
import { ShopRepository } from "../../sales-management/repositories/shop.repository";
import { AnalyticsRepository } from "../repositories/analytics.repository";
import AnalyticsSnapshotModel from "../models/analytics.model";
import { TicketAnalytics } from "../../sales-management/types";
import { IInventoryItem } from "../../inventory-mgt/types";
import {
  AnalyticsContext,
  DashboardOverview,
  SalesTrendPoint,
  BestSeller,
  LowStockAlert,
  ExpensesBreakdownSlice,
  ProfitSummaryRow,
  BestSellersFilters,
  DateRangeFilters,
  ProfitPeriod,
} from "../types/analytics.types";
import { AuthorizationError, NotFoundError } from "../../../shared/utils/AppError";

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
const SALES_TREND_CACHE_TTL_MS = 5 * 60 * 1000;

export class AnalyticsService {
  private saleRepository: TicketRepository;
  private inventoryRepository: InventoryRepository;
  private shopRepository: ShopRepository;
  private analyticsRepository: AnalyticsRepository;

  constructor() {
    this.saleRepository = new TicketRepository();
    this.inventoryRepository = new InventoryRepository();
    this.shopRepository = new ShopRepository();
    this.analyticsRepository = new AnalyticsRepository();
  }

  private async validateShopAccess(shopId: string, context: AnalyticsContext): Promise<void> {
    if (context.userShopId !== shopId) {
      throw new AuthorizationError("You can only access analytics for your own shop");
    }
    const exists = await this.shopRepository.existsAndVerified(shopId);
    if (!exists) {
      throw new NotFoundError("Shop not found or not verified");
    }
  }

  private getStartOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getEndOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  async getDashboardOverview(shopId: string, context: AnalyticsContext): Promise<DashboardOverview> {
    await this.validateShopAccess(shopId, context);
    const today = new Date();
    const start = this.getStartOfDay(today);
    const end = this.getEndOfDay(today);

    const existingSnapshot = await AnalyticsSnapshotModel.findOne({
      shopId,
      type: "dashboard_overview",
    }).sort({ createdAt: -1 });

    if (existingSnapshot && Date.now() - existingSnapshot.createdAt.getTime() < DASHBOARD_CACHE_TTL_MS) {
      return existingSnapshot.payload as DashboardOverview;
    }

    const [salesAnalyticsRaw, expensesTotal, lowStockItems, outOfStockItems] = await Promise.all([
      this.saleRepository.getAnalytics(shopId, {
        startDate: start,
        endDate: end,
        includeRefunded: false,
      }),
      this.analyticsRepository.getExpensesTotal(shopId, start, end),
      this.inventoryRepository.getLowStockItems(shopId),
      this.inventoryRepository.getOutOfStockItems(shopId),
    ]);

    const salesAnalytics = salesAnalyticsRaw as TicketAnalytics;
    const totalSales = salesAnalytics.totalRevenue || 0;
    const totalProfit = salesAnalytics.totalProfit || 0;
    const totalCogs = totalSales - totalProfit;
    const profit = totalProfit - expensesTotal;
    const lowStockAlertCount = lowStockItems.length + outOfStockItems.length;
    const overview: DashboardOverview = {
      date: start.toISOString(),
      totalSales,
      totalCogs,
      totalExpenses: expensesTotal,
      profit,
      lowStockAlertCount,
      totalTransactions: salesAnalytics.totalTickets || 0,
    };

    await AnalyticsSnapshotModel.findOneAndUpdate(
      { shopId, type: "dashboard_overview" },
      {
        shopId,
        type: "dashboard_overview",
        periodStart: start,
        periodEnd: end,
        payload: overview,
      },
      { upsert: true, new: true }
    );

    return overview;
  }

  async getSalesTrend(
    shopId: string,
    days: number,
    includeRefunded: boolean,
    context: AnalyticsContext
  ): Promise<SalesTrendPoint[]> {
    await this.validateShopAccess(shopId, context);
    const now = new Date();
    const start = this.getStartOfDay(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000));

    const type = `sales_trend_${days}_${includeRefunded ? "include_refunded" : "exclude_refunded"}`;

    const existingSnapshot = await AnalyticsSnapshotModel.findOne({
      shopId,
      type,
    }).sort({ createdAt: -1 });

    if (existingSnapshot && Date.now() - existingSnapshot.createdAt.getTime() < SALES_TREND_CACHE_TTL_MS) {
      return existingSnapshot.payload as SalesTrendPoint[];
    }

    const analytics = (await this.saleRepository.getAnalytics(shopId, {
      startDate: start,
      endDate: now,
      includeRefunded,
    })) as TicketAnalytics;

    const dailySales = analytics.dailySales || [];

    const trend = dailySales.map((day) => ({
      date: day.date,
      revenue: day.revenue,
    }));

    await AnalyticsSnapshotModel.findOneAndUpdate(
      { shopId, type },
      {
        shopId,
        type,
        periodStart: start,
        periodEnd: now,
        payload: trend,
      },
      { upsert: true, new: true }
    );

    return trend;
  }

  async getBestSellers(
    shopId: string,
    filters: BestSellersFilters,
    context: AnalyticsContext
  ): Promise<BestSeller[]> {
    await this.validateShopAccess(shopId, context);

    const analytics = (await this.saleRepository.getAnalytics(shopId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
      includeRefunded: false,
    })) as TicketAnalytics;

    const totalRevenue = analytics.totalRevenue || 0;
    const items = (analytics.topSellingItems || []).slice().sort((a, b) => b.revenue - a.revenue);
    const limited = items.slice(0, filters.limit);

    return limited.map((item) => ({
      itemId: item.itemId,
      productName: item.itemName,
      category: item.itemCategory,
      unitsSold: item.quantitySold,
      revenue: item.revenue,
      contribution: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0,
    }));
  }

  async getLowStockAlerts(shopId: string, context: AnalyticsContext): Promise<LowStockAlert[]> {
    await this.validateShopAccess(shopId, context);

    const [lowStockItems, outOfStockItems] = await Promise.all([
      this.inventoryRepository.getLowStockItems(shopId),
      this.inventoryRepository.getOutOfStockItems(shopId),
    ]);

    const alerts: LowStockAlert[] = [];

    (outOfStockItems as IInventoryItem[]).forEach((item) => {
      alerts.push({
        itemId: item._id.toString(),
        productName: item.name,
        currentStock: 0,
        status: "Critical",
        reorderLevel: item.reorderLevel,
        unit: item.unit,
      });
    });

    (lowStockItems as IInventoryItem[]).forEach((item) => {
      if (item.availableQuantity > 0) {
        alerts.push({
          itemId: item._id.toString(),
          productName: item.name,
          currentStock: item.availableQuantity,
          status: "Low",
          reorderLevel: item.reorderLevel,
          unit: item.unit,
        });
      }
    });

    alerts.sort((a, b) => a.currentStock - b.currentStock);

    return alerts;
  }

  async getExpensesBreakdown(
    shopId: string,
    filters: DateRangeFilters,
    context: AnalyticsContext
  ): Promise<ExpensesBreakdownSlice[]> {
    await this.validateShopAccess(shopId, context);

    let start = filters.startDate;
    let end = filters.endDate;

    if (!start || !end) {
      const now = new Date();
      start = this.getStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      end = this.getEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }

    const raw = await this.analyticsRepository.getExpensesByCategory(shopId, start, end);
    const total = raw.reduce((sum, item) => sum + item.total, 0);

    return raw.map((item) => ({
      category: item.category,
      total: item.total,
      percentage: total > 0 ? (item.total / total) * 100 : 0,
    }));
  }

  async getProfitSummary(
    shopId: string,
    period: ProfitPeriod,
    periods: number,
    context: AnalyticsContext
  ): Promise<ProfitSummaryRow[]> {
    await this.validateShopAccess(shopId, context);
    const rows: ProfitSummaryRow[] = [];

    if (period === "monthly") {
      const now = new Date();
      for (let i = periods - 1; i >= 0; i--) {
        const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = this.getStartOfDay(ref);
        const end = this.getEndOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));

        const [salesAnalyticsRaw, expensesTotal] = await Promise.all([
          this.saleRepository.getAnalytics(shopId, {
            startDate: start,
            endDate: end,
            includeRefunded: false,
          }),
          this.analyticsRepository.getExpensesTotal(shopId, start, end),
        ]);

        const salesAnalytics = salesAnalyticsRaw as TicketAnalytics;
        const revenue = salesAnalytics.totalRevenue || 0;
        const totalProfit = salesAnalytics.totalProfit || 0;
        const cogs = revenue - totalProfit;
        const profit = totalProfit - expensesTotal;

        const labelIndex = periods - i;

        rows.push({
          label: `Month ${labelIndex}`,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          revenue,
          cogs,
          expenses: expensesTotal,
          profit,
        });
      }
    } else if (period === "weekly") {
      const today = new Date();
      const endOfToday = this.getEndOfDay(today);

      for (let i = periods - 1; i >= 0; i--) {
        const periodEnd = new Date(endOfToday.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const periodStart = new Date(periodEnd.getTime() - 6 * 24 * 60 * 60 * 1000);

        const start = this.getStartOfDay(periodStart);
        const end = this.getEndOfDay(periodEnd);

        const [salesAnalyticsRaw, expensesTotal] = await Promise.all([
          this.saleRepository.getAnalytics(shopId, {
            startDate: start,
            endDate: end,
            includeRefunded: false,
          }),
          this.analyticsRepository.getExpensesTotal(shopId, start, end),
        ]);

        const salesAnalytics = salesAnalyticsRaw as TicketAnalytics;
        const revenue = salesAnalytics.totalRevenue || 0;
        const totalProfit = salesAnalytics.totalProfit || 0;
        const cogs = revenue - totalProfit;
        const profit = totalProfit - expensesTotal;
        const labelIndex = periods - i;

        rows.push({
          label: `Week ${labelIndex}`,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          revenue,
          cogs,
          expenses: expensesTotal,
          profit,
        });
      }
    } else if (period === "daily") {
      const today = new Date();
      const endOfToday = this.getEndOfDay(today);

      for (let i = periods - 1; i >= 0; i--) {
        const date = new Date(endOfToday.getTime() - i * 24 * 60 * 60 * 1000);
        const start = this.getStartOfDay(date);
        const end = this.getEndOfDay(date);

        const [salesAnalyticsRaw, expensesTotal] = await Promise.all([
          this.saleRepository.getAnalytics(shopId, {
            startDate: start,
            endDate: end,
            includeRefunded: false,
          }),
          this.analyticsRepository.getExpensesTotal(shopId, start, end),
        ]);

        const salesAnalytics = salesAnalyticsRaw as TicketAnalytics;
        const revenue = salesAnalytics.totalRevenue || 0;
        const totalProfit = salesAnalytics.totalProfit || 0;
        const cogs = revenue - totalProfit;
        const profit = totalProfit - expensesTotal;

        rows.push({
          label: date.toLocaleDateString(),
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          revenue,
          cogs,
          expenses: expensesTotal,
          profit,
        });
      }
    }

    return rows;
  }
}
