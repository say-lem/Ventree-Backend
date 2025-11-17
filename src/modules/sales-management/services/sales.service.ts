import { SaleRepository } from "../repositories/sales.repository";
import { InventoryRepository } from "../repositories/inventory.repository";
import { ShopRepository } from "../repositories/shop.repository";
import { StaffRepository } from "../../staff-management/repositories/staff.repository";
import { logSalesAuditEvent } from "../utils/auditLogger";
import { calculateSaleAmounts, validateDiscount } from "../utils/calculations";
import { Types } from "mongoose";
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
  InternalServerError,
} from "../../../shared/utils/AppError";
import {
  RecordSaleInput,
  UpdateSaleInput,
  RefundSaleInput,
  SalesQueryOptions,
  RequestMetadata,
  ISale,
  SalesAnalytics,
} from "../types";

export class SalesService {
  private saleRepository: SaleRepository;
  private inventoryRepository: InventoryRepository;
  private shopRepository: ShopRepository;
  private staffRepository: StaffRepository;

  constructor() {
    this.saleRepository = new SaleRepository();
    this.inventoryRepository = new InventoryRepository();
    this.shopRepository = new ShopRepository();
    this.staffRepository = new StaffRepository();
  }

  /**
   * Validate shop ownership/access
   */
  private async validateShopAccess(
    shopId: string,
    userShopId: string,
    userRole: "owner" | "staff"
  ): Promise<void> {
    // Verify user's shopId matches the requested shopId
    if (userShopId !== shopId) {
      throw new AuthorizationError("You can only access sales for your own shop");
    }

    // Verify shop exists and is verified
    const shopExists = await this.shopRepository.existsAndVerified(shopId);
    if (!shopExists) {
      throw new NotFoundError("Shop not found or not verified");
    }
  }

  /**
   * Record new sale
   */
  async recordSale(input: RecordSaleInput, metadata: RequestMetadata): Promise<ISale> {
    const {
      shopId,
      itemId,
      quantity,
      soldBy,
      paymentMethod,
      discount = 0,
      customerName,
      customerPhone,
      notes,
      transactionReference,
    } = input;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    // Validate discount
    if (discount && !validateDiscount(discount, 50)) {
      // Max 50% discount
      throw new ValidationError("Discount must be between 0 and 50 percent");
    }

    // Check if item exists and belongs to shop
    const itemBelongsToShop = await this.inventoryRepository.itemBelongsToShop(itemId, shopId);
    if (!itemBelongsToShop) {
      throw new NotFoundError("Item not found in this shop");
    }

    // Get item details
    const item = await this.inventoryRepository.findById(itemId);
    if (!item) {
      throw new NotFoundError("Item not found");
    }

    // Check stock availability
    if (quantity > item.availableQuantity) {
      await logSalesAuditEvent({
        requestId,
        action: "SALE_INSUFFICIENT_STOCK",
        shopId,
        performedBy: { userId, role: userRole },
        ip,
        details: {
          itemId,
          itemName: item.name,
          requested: quantity,
          available: item.availableQuantity,
        },
      });

      throw new ValidationError(
        `Insufficient stock available. Requested: ${quantity}, Available: ${item.availableQuantity}`
      );
    }

    // Verify staff exists and belongs to shop
    const staff = await this.staffRepository.findById(soldBy);
    if (!staff) {
      throw new NotFoundError("Staff member not found");
    }
    if (staff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    // Calculate amounts
    const calculations = calculateSaleAmounts({
      quantity,
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      discount,
      taxRate: 0, // Can be configured per shop
    });

    // Reduce stock first (atomic operation)
    try {
      await this.inventoryRepository.reduceStock(itemId, quantity);
    } catch (error) {
      throw new InternalServerError("Failed to update inventory. Please try again.");
    }

    // Create sale record
    let sale;
    try {
      sale = await this.saleRepository.create({
        shopId: item.shopId,
        itemId: item._id,
        itemName: item.name,
        itemCategory: item.category,
        quantitySold: quantity,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        discount: discount || 0,
        taxAmount: calculations.taxAmount,
        totalAmount: calculations.totalAmount,
        profitAmount: calculations.profitAmount,
        soldBy: new Types.ObjectId(soldBy),
        soldByName: staff.staffName,
        paymentMethod,
        transactionReference,
        customerName,
        customerPhone,
        notes,
        date: new Date(),
        refunded: false,
      });

      await logSalesAuditEvent({
        requestId,
        action: "SALE_RECORDED",
        shopId,
        performedBy: { userId, role: userRole },
        saleId: sale._id.toString(),
        ip,
        details: {
          itemName: item.name,
          quantity,
          totalAmount: calculations.totalAmount,
          paymentMethod,
        },
      });

      return sale;
    } catch (error) {
      // Rollback stock if sale creation fails
      await this.inventoryRepository.restoreStock(itemId, quantity);
      throw error;
    }
  }

  /**
   * Get sales list for a shop
   */
  async getSalesList(
    shopId: string,
    options: SalesQueryOptions,
    metadata: RequestMetadata
  ): Promise<{ sales: ISale[]; total: number; page: number; pages: number }> {
    const { requestId, userId, userRole, userShopId } = metadata;

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    const result = await this.saleRepository.findByShopId(shopId, options);

    await logSalesAuditEvent({
      requestId,
      action: "SALES_LIST_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: result.sales.length, filters: options },
    });

    return result;
  }

  /**
   * Get single sale by ID
   */
  async getSaleById(
    saleId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<ISale> {
    const { requestId, userId, userRole, userShopId } = metadata;

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    const sale = await this.saleRepository.findById(saleId);

    if (!sale) {
      throw new NotFoundError("Sale not found");
    }

    // Verify sale belongs to this shop
    if (sale.shopId.toString() !== shopId) {
      throw new AuthorizationError("Sale does not belong to this shop");
    }

    await logSalesAuditEvent({
      requestId,
      action: "SALE_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      saleId,
    });

    return sale;
  }

  /**
   * Update sale details (limited fields)
   */
  async updateSale(
    saleId: string,
    shopId: string,
    updates: UpdateSaleInput,
    metadata: RequestMetadata
  ): Promise<ISale> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Only owners can update sales
    if (userRole !== "owner") {
      throw new AuthorizationError("Only shop owners can update sales records");
    }

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    // Find existing sale
    const existingSale = await this.saleRepository.findById(saleId);
    if (!existingSale) {
      throw new NotFoundError("Sale not found");
    }

    // Verify sale belongs to this shop
    if (existingSale.shopId.toString() !== shopId) {
      throw new AuthorizationError("Sale does not belong to this shop");
    }

    // Prevent updating refunded sales
    if (existingSale.refunded) {
      throw new ValidationError("Cannot update a refunded sale");
    }

    // Update sale
    const updatedSale = await this.saleRepository.update(saleId, updates);

    if (!updatedSale) {
      throw new NotFoundError("Sale not found after update");
    }

    await logSalesAuditEvent({
      requestId,
      action: "SALE_UPDATED",
      shopId,
      performedBy: { userId, role: userRole },
      saleId,
      ip,
      details: {
        updates: Object.keys(updates),
        oldCustomerName: existingSale.customerName,
        newCustomerName: updates.customerName,
      },
    });

    return updatedSale;
  }

  /**
   * Refund a sale
   */
  async refundSale(
    saleId: string,
    shopId: string,
    refundInput: RefundSaleInput,
    metadata: RequestMetadata
  ): Promise<ISale> {
    const { reason, refundedBy } = refundInput;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Only owners can refund sales
    if (userRole !== "owner") {
      throw new AuthorizationError("Only shop owners can refund sales");
    }

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    // Verify refundedBy staff exists and belongs to shop
    const refundingStaff = await this.staffRepository.findById(refundedBy);
    if (!refundingStaff) {
      throw new NotFoundError("Staff member not found");
    }
    if (refundingStaff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    // Find sale
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new NotFoundError("Sale not found");
    }

    // Verify sale belongs to this shop
    if (sale.shopId.toString() !== shopId) {
      throw new AuthorizationError("Sale does not belong to this shop");
    }

    // Check if already refunded
    if (sale.refunded) {
      throw new ValidationError("Sale has already been refunded");
    }

    // Check if refund is within acceptable timeframe (e.g., 30 days)
    const daysSinceSale = Math.floor(
      (Date.now() - sale.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceSale > 30) {
      throw new ValidationError("Refund period has expired (30 days maximum)");
    }

    // Process refund
    const refundedSale = await this.saleRepository.refund(saleId, refundedBy, reason);

    if (!refundedSale) {
      throw new NotFoundError("Sale not found during refund");
    }

    // Restore stock
    await this.inventoryRepository.restoreStock(
      sale.itemId.toString(),
      sale.quantitySold
    );

    await logSalesAuditEvent({
      requestId,
      action: "SALE_REFUNDED",
      shopId,
      performedBy: { userId, role: userRole },
      saleId,
      ip,
      details: {
        itemName: sale.itemName,
        quantity: sale.quantitySold,
        amount: sale.totalAmount,
        reason,
        daysSinceSale,
      },
    });

    return refundedSale;
  }

  /**
   * Get sales analytics
   */
  async getSalesAnalytics(
    shopId: string,
    options: SalesQueryOptions,
    metadata: RequestMetadata
  ): Promise<SalesAnalytics> {
    const { requestId, userId, userRole, userShopId } = metadata;

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    const analytics = await this.saleRepository.getAnalytics(shopId, options);

    // Calculate additional metrics
    const averageProfit =
      analytics.totalTransactions > 0
        ? analytics.totalProfit / analytics.totalTransactions
        : 0;

    await logSalesAuditEvent({
      requestId,
      action: "SALES_ANALYTICS_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: {
        dateRange: {
          start: options.startDate,
          end: options.endDate,
        },
      },
    });

    return {
      ...analytics,
      averageProfit,
    };
  }

  /**
   * Search sales
   */
  async searchSales(
    shopId: string,
    searchTerm: string,
    page: number,
    limit: number,
    metadata: RequestMetadata
  ): Promise<{ sales: ISale[]; total: number }> {
    const { requestId, userId, userRole, userShopId } = metadata;

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    const result = await this.saleRepository.search(shopId, searchTerm, page, limit);

    await logSalesAuditEvent({
      requestId,
      action: "SALES_SEARCHED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { searchTerm, resultsCount: result.total },
    });

    return result;
  }

  /**
   * Get sales by date range for reporting
   */
  async getSalesReport(
    shopId: string,
    startDate: Date,
    endDate: Date,
    metadata: RequestMetadata
  ): Promise<{
    summary: any;
    sales: ISale[];
    totalPages: number;
  }> {
    const { requestId, userId, userRole, userShopId } = metadata;

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    // Get analytics for the period
    const analytics = await this.saleRepository.getAnalytics(shopId, {
      startDate,
      endDate,
      includeRefunded: true,
    });

    // Get all sales in the period
    const { sales, total, pages } = await this.saleRepository.findByShopId(shopId, {
      startDate,
      endDate,
      includeRefunded: true,
      limit: 1000, // High limit for reports
    });

    await logSalesAuditEvent({
      requestId,
      action: "SALES_REPORT_GENERATED",
      shopId,
      performedBy: { userId, role: userRole },
      details: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalSales: total,
      },
    });

    return {
      summary: analytics,
      sales,
      totalPages: pages,
    };
  }

  /**
   * Delete sale (hard delete - owner only)
   */
  async deleteSale(
    saleId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<void> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Only owners can delete sales
    if (userRole !== "owner") {
      throw new AuthorizationError("Only shop owners can delete sales records");
    }

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    // Find sale
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new NotFoundError("Sale not found");
    }

    // Verify sale belongs to this shop
    if (sale.shopId.toString() !== shopId) {
      throw new AuthorizationError("Sale does not belong to this shop");
    }

    // Restore stock if not already refunded
    if (!sale.refunded) {
      await this.inventoryRepository.restoreStock(
        sale.itemId.toString(),
        sale.quantitySold
      );
    }

    // Delete sale
    await this.saleRepository.delete(saleId);

    await logSalesAuditEvent({
      requestId,
      action: "SALE_DELETED",
      shopId,
      performedBy: { userId, role: userRole },
      saleId,
      ip,
      details: {
        itemName: sale.itemName,
        quantity: sale.quantitySold,
        amount: sale.totalAmount,
        wasRefunded: sale.refunded,
      },
    });
  }

  /**
   * Get top performing items
   */
  async getTopPerformingItems(
    shopId: string,
    limit: number,
    startDate?: Date,
    endDate?: Date,
    metadata?: RequestMetadata
  ): Promise<any[]> {
    if (metadata) {
      await this.validateShopAccess(shopId, metadata.userShopId, metadata.userRole);
    }

    const analytics = await this.saleRepository.getAnalytics(shopId, {
      startDate,
      endDate,
    });

    return analytics.topSellingItems.slice(0, limit);
  }

  /**
   * Get staff performance
   */
  async getStaffPerformance(
    shopId: string,
    startDate?: Date,
    endDate?: Date,
    metadata?: RequestMetadata
  ): Promise<any[]> {
    if (metadata) {
      await this.validateShopAccess(shopId, metadata.userShopId, metadata.userRole);
    }

    const analytics = await this.saleRepository.getAnalytics(shopId, {
      startDate,
      endDate,
    });

    return analytics.salesByStaff;
  }
}