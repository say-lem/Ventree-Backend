import { SaleRepository } from "../repositories/sales.repository";
import { InventoryRepository } from "../repositories/inventory.repository";
import { ShopRepository } from "../repositories/shop.repository";
import { StaffRepository } from "../../staff-management/repositories/staff.repository";
import { logSalesAuditEvent } from "../utils/auditLogger";
import { calculateSaleAmounts, validateDiscount } from "../utils/calculations";
import { Types } from "mongoose";
import { AutoNotificationTriggers } from "../../notification";
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
  RecordCreditPaymentInput,
  ICreditPayment,
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

  // Validate shop ownership/access
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

  // Record new sale
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
      customerAddress,
      dueDate,
      notes,
      transactionReference,
    } = input;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    // Validate credit sale requirements
    const isCredit = paymentMethod === "credit";
    if (isCredit) {
      if (!customerName || !customerPhone) {
        throw new ValidationError(
          "Customer name and phone number are required for credit sales"
        );
      }
    }

    // Validate discount
    if (discount && !validateDiscount(discount, 50)) {
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
      throw new ValidationError(
        `Insufficient stock. Requested: ${quantity}, Available: ${item.availableQuantity}`
      );
    }

    // Verify staff
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
      taxRate: 0,
    });

    // Reduce stock
    try {
      await this.inventoryRepository.reduceStock(itemId, quantity, soldBy, staff.staffName);
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
        customerAddress,
        notes,
        date: new Date(),
        refunded: false,

        // Credit sale fields
        isCredit,
        creditStatus: isCredit ? "pending" : "paid",
        amountPaid: isCredit ? 0 : calculations.totalAmount,
        amountOwed: isCredit ? calculations.totalAmount : 0,
        dueDate: isCredit ? (dueDate || this.getDefaultDueDate()) : undefined,
        payments: [],
      });

      // After sale is successfully recorded, compute new stock level
      const newAvailableQuantity = item.availableQuantity - quantity;

      // Trigger low stock or out of stock notifications when crossing thresholds
      try {
        if (newAvailableQuantity === 0 && item.availableQuantity > 0) {
          await AutoNotificationTriggers.onOutOfStock(
            item._id.toString(),
            shopId,
            item.name,
            {
              id: userId,
              shopId,
              role: userRole,
              profileId: userId,
              staffName: staff.staffName,
            }
          );
        } else if (
          newAvailableQuantity > 0 &&
          item.availableQuantity > item.reorderLevel &&
          newAvailableQuantity <= item.reorderLevel
        ) {
          await AutoNotificationTriggers.onLowStock(
            item._id.toString(),
            shopId,
            item.name,
            newAvailableQuantity,
            item.unit,
            item.reorderLevel,
            {
              id: userId,
              shopId,
              role: userRole,
              profileId: userId,
              staffName: staff.staffName,
            }
          );
        }
      } catch (notificationError) {
        // Do not fail the sale if notifications fail
        console.error("[SalesService] Failed to trigger inventory notifications", notificationError);
      }

      // Trigger sale completed notification for the owner
      try {
        await AutoNotificationTriggers.onSaleCompleted(
          sale._id.toString(),
          shopId,
          soldBy,
          quantity,
          calculations.totalAmount,
          "NGN",
          staff.staffName,
          {
            id: userId,
            shopId,
            role: userRole,
            profileId: userId,
            staffName: staff.staffName,
          }
        );
      } catch (notificationError) {
        console.error("[SalesService] Failed to trigger sale completed notification", notificationError);
      }

      await logSalesAuditEvent({
        requestId,
        action: isCredit ? "CREDIT_SALE_RECORDED" : "SALE_RECORDED",
        shopId,
        performedBy: { userId, role: userRole },
        saleId: sale._id.toString(),
        ip,
        details: {
          itemName: item.name,
          quantity,
          totalAmount: calculations.totalAmount,
          paymentMethod,
          isCredit,
          customerName: isCredit ? customerName : undefined,
        },
      });

      return sale;
    } catch (error) {
      await this.inventoryRepository.restoreStock(itemId, quantity);
      throw error;
    }
  }

  // Get default due date (30 days from now)
  private getDefaultDueDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  }

  // Record credit payment

  async recordCreditPayment(
    input: RecordCreditPaymentInput,
    metadata: RequestMetadata
  ): Promise<ISale> {
    const { saleId, shopId, amount, paymentMethod, receivedBy, transactionReference, notes } = input;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    // Find sale
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new NotFoundError("Sale not found");
    }

    // Verify sale belongs to shop
    if (sale.shopId.toString() !== shopId) {
      throw new AuthorizationError("Sale does not belong to this shop");
    }

    // Verify it's a credit sale
    if (!sale.isCredit) {
      throw new ValidationError("This is not a credit sale");
    }

    // Verify not fully paid
    if (sale.creditStatus === "paid") {
      throw new ValidationError("This credit sale has already been fully paid");
    }

    // Verify not refunded
    if (sale.refunded) {
      throw new ValidationError("Cannot record payment for a refunded sale");
    }

    // Validate payment amount
    if (amount <= 0) {
      throw new ValidationError("Payment amount must be greater than 0");
    }
    if (amount > sale.amountOwed) {
      throw new ValidationError(
        `Payment amount (${amount}) exceeds amount owed (${sale.amountOwed})`
      );
    }

    // Verify staff
    const staff = await this.staffRepository.findById(receivedBy.toString());
    if (!staff) {
      throw new NotFoundError("Staff member not found");
    }
    if (staff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    // Record payment
    const payment: ICreditPayment = {
      amount,
      paymentMethod,
      paymentDate: new Date(),
      receivedBy: new Types.ObjectId(receivedBy),
      receivedByName: staff.staffName,
      transactionReference,
      notes,
    };

    const updatedSale = await this.saleRepository.recordCreditPayment(saleId, payment as ICreditPayment);

    if (!updatedSale) {
      throw new NotFoundError("Sale not found during payment recording");
    }

    await logSalesAuditEvent({
      requestId,
      action: "CREDIT_PAYMENT_RECORDED",
      shopId,
      performedBy: { userId, role: userRole },
      saleId,
      ip,
      details: {
        amount,
        paymentMethod,
        previousAmountOwed: sale.amountOwed,
        newAmountOwed: updatedSale.amountOwed,
        newStatus: updatedSale.creditStatus,
      },
    });

    return updatedSale;
  }

  /**
   * Get credit sales list
   */
  async getCreditSales(
    shopId: string,
    options: SalesQueryOptions,
    metadata: RequestMetadata
  ): Promise<{ sales: ISale[]; total: number; page: number; pages: number }> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const result = await this.saleRepository.findCreditSales(shopId, options);

    await logSalesAuditEvent({
      requestId,
      action: "CREDIT_SALES_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: result.sales.length, filters: options },
    });

    return result;
  }

  // Get credit sales summary
  async getCreditSalesSummary(
    shopId: string,
    metadata: RequestMetadata
  ): Promise<any> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const summary = await this.saleRepository.getCreditSalesSummary(shopId);

    await logSalesAuditEvent({
      requestId,
      action: "CREDIT_SUMMARY_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
    });

    return summary;
  }

  // Get overdue credit sales
  async getOverdueCreditSales(
    shopId: string,
    metadata: RequestMetadata
  ): Promise<ISale[]> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const overdue = await this.saleRepository.getOverdueCreditSales(shopId);

    await logSalesAuditEvent({
      requestId,
      action: "OVERDUE_CREDITS_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: overdue.length },
    });

    return overdue;
  }

  // Get customer credit history
  async getCustomerCreditHistory(
    shopId: string,
    customerPhone: string,
    metadata: RequestMetadata
  ): Promise<{ sales: ISale[]; summary: any }> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const sales = await this.saleRepository.getCustomerCreditHistory(shopId, customerPhone);

    // Calculate customer summary
    const summary = sales.reduce(
      (acc, sale) => {
        acc.totalTransactions += 1;
        acc.totalAmount += sale.totalAmount;
        acc.totalPaid += sale.amountPaid;
        acc.totalOwed += sale.amountOwed;
        if (sale.creditStatus !== "paid") acc.pendingCount += 1;
        return acc;
      },
      { totalTransactions: 0, totalAmount: 0, totalPaid: 0, totalOwed: 0, pendingCount: 0 }
    );

    await logSalesAuditEvent({
      requestId,
      action: "CUSTOMER_CREDIT_HISTORY_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { customerPhone, totalOwed: summary.totalOwed },
    });

    return { sales, summary };
  }

  // Get sales list for a shop
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

  // Get single sale by ID
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

  // Update sale details (limited fields)
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

  // Refund a sale
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
      sale.quantitySold,
      refundedBy,
      refundingStaff.staffName
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

  // Get sales analytics
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

  // Search sales
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

  // Get sales by date range for reporting
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

  // Delete sale (hard delete - owner only)
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

  // Get top performing items
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

  // Get staff performance
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