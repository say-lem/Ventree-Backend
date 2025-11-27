import { TicketRepository } from "../repositories/sales.repository";
import { InventoryRepository } from "../repositories/inventory.repository";
import { ShopRepository } from "../repositories/shop.repository";
import { StaffRepository } from "../../staff-management/repositories/staff.repository";
import { logSalesAuditEvent } from "../utils/auditLogger";
import { Types } from "mongoose";
import { AutoNotificationTriggers } from "../../notification";
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  InternalServerError,
} from "../../../shared/utils/AppError";
import {
  CreateTicketInput,
  TicketQueryOptions,
  RequestMetadata,
  ITicket,
  TicketAnalytics,
  RecordCreditPaymentInput,
  ICreditPayment,
  RefundTicketInput,
  UpdateTicketInput,
  ITicketItem,
} from "../types";

export class TicketService {
  private ticketRepository: TicketRepository;
  private inventoryRepository: InventoryRepository;
  private shopRepository: ShopRepository;
  private staffRepository: StaffRepository;

  constructor() {
    this.ticketRepository = new TicketRepository();
    this.inventoryRepository = new InventoryRepository();
    this.shopRepository = new ShopRepository();
    this.staffRepository = new StaffRepository();
  }

  private async validateShopAccess(
    shopId: string,
    userShopId: string,
    userRole: "owner" | "staff"
  ): Promise<void> {
    if (userShopId !== shopId) {
      throw new AuthorizationError("You can only access tickets for your own shop");
    }

    const shopExists = await this.shopRepository.existsAndVerified(shopId);
    if (!shopExists) {
      throw new NotFoundError("Shop not found or not verified");
    }
  }

  // Create a new ticket (multi-item sale)
  async createTicket(input: CreateTicketInput, metadata: RequestMetadata): Promise<ITicket> {
    const {
      shopId,
      items,
      soldBy,
      paymentMethod,
      customerName,
      customerPhone,
      customerAddress,
      dueDate,
      notes,
      transactionReference,
    } = input;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    // Validate credit sale requirements
    const isCredit = paymentMethod === "credit";
    if (isCredit && (!customerName || !customerPhone)) {
      throw new ValidationError(
        "Customer name and phone number are required for credit sales"
      );
    }

    // Validate at least one item
    if (!items || items.length === 0) {
      throw new ValidationError("Ticket must contain at least one item");
    }

    // Verify staff
    const staff = await this.staffRepository.findById(soldBy);
    if (!staff) {
      throw new NotFoundError("Staff member not found");
    }
    if (staff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    // Fetch and validate all items
    const ticketItems: ITicketItem[] = [];
    const inventoryUpdates: Array<{
      itemId: string;
      quantity: number;
      name: string;
    }> = [];

    let subtotal = 0;
    let totalProfit = 0;
    let totalItemCount = 0;

    for (const inputItem of items) {
      const { itemId, quantity, discount = 0 } = inputItem;

      // Validate discount
      if (discount < 0 || discount > 50) {
        throw new ValidationError(`Discount must be between 0 and 50 percent for item ${itemId}`);
      }

      // Get item from inventory
      const inventoryItem = await this.inventoryRepository.findById(itemId);
      if (!inventoryItem) {
        throw new NotFoundError(`Item with ID ${itemId} not found`);
      }

      // Check item belongs to shop
      if (inventoryItem.shopId.toString() !== shopId) {
        throw new AuthorizationError(`Item ${inventoryItem.name} does not belong to this shop`);
      }

      // Check stock availability
      if (quantity > inventoryItem.availableQuantity) {
        throw new ValidationError(
          `Insufficient stock for ${inventoryItem.name}. Requested: ${quantity}, Available: ${inventoryItem.availableQuantity}`
        );
      }

      // Calculate line item totals
      const lineSubtotal = quantity * inventoryItem.sellingPrice;
      const discountAmount = (lineSubtotal * discount) / 100;
      const lineTotal = lineSubtotal - discountAmount;
      const lineProfit = quantity * (inventoryItem.sellingPrice - inventoryItem.costPrice) - discountAmount;

      ticketItems.push({
        itemId: new Types.ObjectId(itemId),
        itemName: inventoryItem.name,
        itemCategory: inventoryItem.category,
        quantitySold: quantity,
        costPrice: inventoryItem.costPrice,
        sellingPrice: inventoryItem.sellingPrice,
        discount,
        lineTotal,
        lineProfit,
      });

      inventoryUpdates.push({
        itemId,
        quantity,
        name: inventoryItem.name,
      });

      subtotal += lineTotal;
      totalProfit += lineProfit;
      totalItemCount += quantity;
    }

    // Calculate tax (if applicable)
    const taxAmount = 0; // Add tax logic if needed
    const totalAmount = subtotal + taxAmount;

    // Reduce stock for all items
    try {
      for (const update of inventoryUpdates) {
        await this.inventoryRepository.reduceStock(
          update.itemId,
          update.quantity,
          soldBy,
          staff.staffName
        );
      }
    } catch (error) {
      throw new InternalServerError("Failed to update inventory. Please try again.");
    }

    // Create ticket
    let ticket;
    try {
      ticket = await this.ticketRepository.create({
        shopId: new Types.ObjectId(shopId),
        items: ticketItems,
        subtotal,
        taxAmount,
        totalAmount,
        totalProfit,
        totalItemCount,
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
        isCredit,
        creditStatus: isCredit ? "pending" : "paid",
        amountPaid: isCredit ? 0 : totalAmount,
        amountOwed: isCredit ? totalAmount : 0,
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
        action: isCredit ? "CREDIT_TICKET_CREATED" : "TICKET_CREATED",
        shopId,
        performedBy: { userId, role: userRole },
        saleId: ticket._id.toString(),
        ip,
        details: {
          ticketNumber: ticket.ticketNumber,
          itemCount: ticketItems.length,
          totalAmount,
          paymentMethod,
          isCredit,
          customerName: isCredit ? customerName : undefined,
        },
      });

      return ticket;
    } catch (error) {
      // Rollback inventory updates
      for (const update of inventoryUpdates) {
        await this.inventoryRepository.restoreStock(update.itemId, update.quantity);
      }
      throw error;
    }
  }

  private getDefaultDueDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  }

  // Get ticket list (summary view)
  async getTicketList(
    shopId: string,
    options: TicketQueryOptions,
    metadata: RequestMetadata
  ): Promise<any> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const result = await this.ticketRepository.findByShopId(shopId, options);

    await logSalesAuditEvent({
      requestId,
      action: "TICKET_LIST_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: result.tickets.length, filters: options },
    });

    return result;
  }

  // Get all items sold (individual item view)
  async getAllItemsSold(
    shopId: string,
    options: TicketQueryOptions,
    metadata: RequestMetadata
  ): Promise<any> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const result = await this.ticketRepository.getAllItemsSold(shopId, options);

    await logSalesAuditEvent({
      requestId,
      action: "ITEMS_SOLD_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: result.items.length, filters: options },
    });

    return result;
  }

  // Get single ticket by ID (with all items)
  async getTicketById(
    ticketId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<ITicket> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const ticket = await this.ticketRepository.findById(ticketId);

    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (ticket.shopId.toString() !== shopId) {
      throw new AuthorizationError("Ticket does not belong to this shop");
    }

    await logSalesAuditEvent({
      requestId,
      action: "TICKET_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      saleId: ticketId,
    });

    return ticket;
  }

  // Update ticket
  async updateTicket(
    ticketId: string,
    shopId: string,
    updates: UpdateTicketInput,
    metadata: RequestMetadata
  ): Promise<ITicket> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    if (userRole !== "owner") {
      throw new AuthorizationError("Only shop owners can update tickets");
    }

    await this.validateShopAccess(shopId, userShopId, userRole);

    const existingTicket = await this.ticketRepository.findById(ticketId);
    if (!existingTicket) {
      throw new NotFoundError("Ticket not found");
    }

    if (existingTicket.shopId.toString() !== shopId) {
      throw new AuthorizationError("Ticket does not belong to this shop");
    }

    if (existingTicket.refunded) {
      throw new ValidationError("Cannot update a refunded ticket");
    }

    const updatedTicket = await this.ticketRepository.update(ticketId, updates);

    if (!updatedTicket) {
      throw new NotFoundError("Ticket not found after update");
    }

    await logSalesAuditEvent({
      requestId,
      action: "TICKET_UPDATED",
      shopId,
      performedBy: { userId, role: userRole },
      saleId: ticketId,
      ip,
      details: { updates: Object.keys(updates) },
    });

    return updatedTicket;
  }

  // Refund ticket
  async refundTicket(
    ticketId: string,
    shopId: string,
    refundInput: RefundTicketInput,
    metadata: RequestMetadata
  ): Promise<ITicket> {
    const { reason, refundedBy } = refundInput;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    if (userRole !== "owner") {
      throw new AuthorizationError("Only shop owners can refund tickets");
    }

    await this.validateShopAccess(shopId, userShopId, userRole);

    const refundingStaff = await this.staffRepository.findById(refundedBy);
    if (!refundingStaff) {
      throw new NotFoundError("Staff member not found");
    }
    if (refundingStaff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (ticket.shopId.toString() !== shopId) {
      throw new AuthorizationError("Ticket does not belong to this shop");
    }

    if (ticket.refunded) {
      throw new ValidationError("Ticket has already been refunded");
    }

    const daysSinceTicket = Math.floor(
      (Date.now() - ticket.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceTicket > 30) {
      throw new ValidationError("Refund period has expired (30 days maximum)");
    }

    const refundedTicket = await this.ticketRepository.refund(ticketId, refundedBy, reason);

    if (!refundedTicket) {
      throw new NotFoundError("Ticket not found during refund");
    }

    // Restore stock for all items
    for (const item of ticket.items) {
      await this.inventoryRepository.restoreStock(
        item.itemId.toString(),
        item.quantitySold,
        refundedBy,
        refundingStaff.staffName
      );
    }

    await logSalesAuditEvent({
      requestId,
      action: "TICKET_REFUNDED",
      shopId,
      performedBy: { userId, role: userRole },
      saleId: ticketId,
      ip,
      details: {
        ticketNumber: ticket.ticketNumber,
        itemCount: ticket.items.length,
        amount: ticket.totalAmount,
        reason,
        daysSinceTicket,
      },
    });

    return refundedTicket;
  }

  // Delete ticket
  async deleteTicket(
    ticketId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<void> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    if (userRole !== "owner") {
      throw new AuthorizationError("Only shop owners can delete tickets");
    }

    await this.validateShopAccess(shopId, userShopId, userRole);

    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (ticket.shopId.toString() !== shopId) {
      throw new AuthorizationError("Ticket does not belong to this shop");
    }

    if (!ticket.refunded) {
      for (const item of ticket.items) {
        await this.inventoryRepository.restoreStock(
          item.itemId.toString(),
          item.quantitySold
        );
      }
    }

    await this.ticketRepository.delete(ticketId);

    await logSalesAuditEvent({
      requestId,
      action: "TICKET_DELETED",
      shopId,
      performedBy: { userId, role: userRole },
      saleId: ticketId,
      ip,
      details: {
        ticketNumber: ticket.ticketNumber,
        itemCount: ticket.items.length,
        amount: ticket.totalAmount,
        wasRefunded: ticket.refunded,
      },
    });
  }

  // Get analytics
  async getAnalytics(
    shopId: string,
    options: TicketQueryOptions,
    metadata: RequestMetadata
  ): Promise<TicketAnalytics> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const analytics = await this.ticketRepository.getAnalytics(shopId, options);

    const averageProfit =
      analytics.totalTickets > 0
        ? analytics.totalProfit / analytics.totalTickets
        : 0;

    await logSalesAuditEvent({
      requestId,
      action: "ANALYTICS_VIEWED",
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

  // Credit payment
  async recordCreditPayment(
    input: RecordCreditPaymentInput,
    metadata: RequestMetadata
  ): Promise<ITicket> {
    const { ticketId, shopId, amount, paymentMethod, receivedBy, transactionReference, notes } = input;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (ticket.shopId.toString() !== shopId) {
      throw new AuthorizationError("Ticket does not belong to this shop");
    }

    if (!ticket.isCredit) {
      throw new ValidationError("This is not a credit sale");
    }

    if (ticket.creditStatus === "paid") {
      throw new ValidationError("This credit sale has already been fully paid");
    }

    if (ticket.refunded) {
      throw new ValidationError("Cannot record payment for a refunded ticket");
    }

    if (amount <= 0) {
      throw new ValidationError("Payment amount must be greater than 0");
    }

    if (amount > ticket.amountOwed) {
      throw new ValidationError(
        `Payment amount (${amount}) exceeds amount owed (${ticket.amountOwed})`
      );
    }

    const staff = await this.staffRepository.findById(receivedBy.toString());
    if (!staff) {
      throw new NotFoundError("Staff member not found");
    }
    if (staff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    const payment: ICreditPayment = {
      amount,
      paymentMethod,
      paymentDate: new Date(),
      receivedBy: new Types.ObjectId(receivedBy),
      receivedByName: staff.staffName,
      transactionReference,
      notes,
    };

    const updatedTicket = await this.ticketRepository.recordCreditPayment(ticketId, payment);

    if (!updatedTicket) {
      throw new NotFoundError("Ticket not found during payment recording");
    }

    await logSalesAuditEvent({
      requestId,
      action: "CREDIT_PAYMENT_RECORDED",
      shopId,
      performedBy: { userId, role: userRole },
      saleId: ticketId,
      ip,
      details: {
        amount,
        paymentMethod,
        previousAmountOwed: ticket.amountOwed,
        newAmountOwed: updatedTicket.amountOwed,
        newStatus: updatedTicket.creditStatus,
      },
    });

    return updatedTicket;
  }

  // Credit sales methods
  async getCreditTickets(
    shopId: string,
    options: TicketQueryOptions,
    metadata: RequestMetadata
  ): Promise<any> {
    const { requestId, userId, userRole, userShopId } = metadata;
    await this.validateShopAccess(shopId, userShopId, userRole);
    const result = await this.ticketRepository.findCreditTickets(shopId, options);
    await logSalesAuditEvent({
      requestId,
      action: "CREDIT_TICKETS_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: result.tickets.length, filters: options },
    });
    return result;
  }

  async getCreditSalesSummary(shopId: string, metadata: RequestMetadata): Promise<any> {
    const { requestId, userId, userRole, userShopId } = metadata;
    await this.validateShopAccess(shopId, userShopId, userRole);
    const summary = await this.ticketRepository.getCreditSalesSummary(shopId);
    await logSalesAuditEvent({
      requestId,
      action: "CREDIT_SUMMARY_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
    });
    return summary;
  }

  async getOverdueCreditTickets(shopId: string, metadata: RequestMetadata): Promise<ITicket[]> {
    const { requestId, userId, userRole, userShopId } = metadata;
    await this.validateShopAccess(shopId, userShopId, userRole);
    const overdue = await this.ticketRepository.getOverdueCreditTickets(shopId);
    await logSalesAuditEvent({
      requestId,
      action: "OVERDUE_CREDITS_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: overdue.length },
    });
    return overdue;
  }

  async getCustomerCreditHistory(
    shopId: string,
    customerPhone: string,
    metadata: RequestMetadata
  ): Promise<{ tickets: ITicket[]; summary: any }> {
    const { requestId, userId, userRole, userShopId } = metadata;
    await this.validateShopAccess(shopId, userShopId, userRole);
    const tickets = await this.ticketRepository.getCustomerCreditHistory(shopId, customerPhone);
    const summary = tickets.reduce(
      (acc, ticket) => {
        acc.totalTransactions += 1;
        acc.totalAmount += ticket.totalAmount;
        acc.totalPaid += ticket.amountPaid;
        acc.totalOwed += ticket.amountOwed;
        if (ticket.creditStatus !== "paid") acc.pendingCount += 1;
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
    return { tickets, summary };
  }

  async searchTickets(
    shopId: string,
    searchTerm: string,
    page: number,
    limit: number,
    metadata: RequestMetadata
  ): Promise<any> {
    const { requestId, userId, userRole, userShopId } = metadata;
    await this.validateShopAccess(shopId, userShopId, userRole);
    const result = await this.ticketRepository.search(shopId, searchTerm, page, limit);
    await logSalesAuditEvent({
      requestId,
      action: "TICKETS_SEARCHED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { searchTerm, resultsCount: result.total },
    });
    return result;
  }
}