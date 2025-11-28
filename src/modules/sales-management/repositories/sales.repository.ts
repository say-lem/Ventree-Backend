import Ticket from "../models/sales";
import { ITicket, ICreditPayment, TicketQueryOptions, ITicketSummary } from "../types";
import { Types } from "mongoose";

export class TicketRepository {
  
  // Generate next ticket number for a shop with prefix
  private async generateTicketNumber(shopId: Types.ObjectId, shopName: string): Promise<string> {
    try {
      // Create prefix from first 3 letters of shop name (uppercase)
      const prefix = shopName.substring(0, 3).toUpperCase();
      
      // Find the ticket with the highest number for this shop
      const lastTicket = await Ticket.findOne({ shopId })
        .sort({ ticketNumber: -1 })
        .select("ticketNumber");
      
      let sequence = 1;
      if (lastTicket && lastTicket.ticketNumber) {
        // Extract the numeric part from the ticket number (e.g., "ABC-0001" -> 1)
        const parts = lastTicket.ticketNumber.split('-');
        if (parts.length === 2) {
          const lastSequence = parseInt(parts[1], 10);
          if (!isNaN(lastSequence) && lastSequence > 0) {
            sequence = lastSequence + 1;
          }
        }
      }
      
      // Format as PREFIX-0001, PREFIX-0002, etc.
      return `${prefix}-${String(sequence).padStart(4, "0")}`;
    } catch (error) {
      // If there's an error, default to first ticket with prefix
      const prefix = shopName.substring(0, 3).toUpperCase();
      return `${prefix}-0001`;
    }
  }
  
  // Create new ticket
  async create(data: Partial<ITicket> & { shopName?: string }): Promise<ITicket> {
    // Generate ticketNumber if not provided
    if (!data.ticketNumber && data.shopId && data.shopName) {
      data.ticketNumber = await this.generateTicketNumber(
        data.shopId as Types.ObjectId, 
        data.shopName
      );
    }
    
    // Remove shopName from data before creating (if it's not part of the schema)
    const { shopName, ...ticketData } = data;
    
    return await Ticket.create(ticketData);
  }
  
  // Find ticket by ID with full details
  async findById(ticketId: string): Promise<ITicket | null> {
    const ticket = await Ticket.findById(ticketId)
      .populate("soldBy", "staffName phoneNumber");
    return ticket as ITicket | null;
  }
  
  // Find tickets by shop with filters and pagination
  async findByShopId(
    shopId: string,
    options: TicketQueryOptions = {}
  ): Promise<{ tickets: ITicketSummary[]; total: number; page: number; pages: number }> {
    const {
      startDate,
      endDate,
      soldBy,
      paymentMethod,
      includeRefunded = false,
      isCredit,
      creditStatus,
      page = 1,
      limit = 20,
      sortBy = "date",
      sortOrder = "desc",
    } = options;
  
    const query: any = { shopId: new Types.ObjectId(shopId) };
  
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
  
    if (soldBy) query.soldBy = new Types.ObjectId(soldBy);
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (!includeRefunded) query.refunded = false;
    if (typeof isCredit === "boolean") query.isCredit = isCredit;
    if (creditStatus) query.creditStatus = creditStatus;
  
    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
  
    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .select("ticketNumber totalAmount totalItemCount soldByName paymentMethod date isCredit creditStatus amountOwed refunded")
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .lean(),
      Ticket.countDocuments(query),
    ]);
  
    return {
      tickets: tickets as unknown as ITicketSummary[],
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // Get all items sold (for backward compatibility with existing sales endpoints)
  async getAllItemsSold(
    shopId: string,
    options: TicketQueryOptions = {}
  ): Promise<{ items: any[]; total: number; page: number; pages: number }> {
    const {
      startDate,
      endDate,
      soldBy,
      paymentMethod,
      includeRefunded = false,
      page = 1,
      limit = 20,
      sortBy = "date",
      sortOrder = "desc",
    } = options;

    const match: any = { shopId: new Types.ObjectId(shopId) };

    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = startDate;
      if (endDate) match.date.$lte = endDate;
    }

    if (soldBy) match.soldBy = new Types.ObjectId(soldBy);
    if (paymentMethod) match.paymentMethod = paymentMethod;
    if (!includeRefunded) match.refunded = false;

    const skip = (page - 1) * limit;

    // Unwind items and project individual sales
    const pipeline: any[] = [
      { $match: match },
      { $unwind: "$items" },
      {
        $project: {
          ticketId: "$_id",
          ticketNumber: 1,
          itemId: "$items.itemId",
          itemName: "$items.itemName",
          itemCategory: "$items.itemCategory",
          quantitySold: "$items.quantitySold",
          costPrice: "$items.costPrice",
          sellingPrice: "$items.sellingPrice",
          discount: "$items.discount",
          lineTotal: "$items.lineTotal",
          lineProfit: "$items.lineProfit",
          soldBy: 1,
          soldByName: 1,
          paymentMethod: 1,
          customerName: 1,
          customerPhone: 1,
          date: 1,
          refunded: 1,
        },
      },
      { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 } },
    ];

    const [items, totalResult] = await Promise.all([
      Ticket.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
      Ticket.aggregate([...pipeline, { $count: "total" }]),
    ]);

    const total = totalResult[0]?.total || 0;

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // Update ticket
  async update(ticketId: string, updates: Partial<ITicket>): Promise<ITicket | null> {
    return await Ticket.findByIdAndUpdate(ticketId, updates, { new: true });
  }

  // Process refund
  async refund(
    ticketId: string,
    refundedBy: string,
    reason: string
  ): Promise<ITicket | null> {
    return await Ticket.findByIdAndUpdate(
      ticketId,
      {
        refunded: true,
        refundedAt: new Date(),
        refundedBy: new Types.ObjectId(refundedBy),
        refundReason: reason,
      },
      { new: true }
    );
  }

  // Get analytics
  async getAnalytics(shopId: string, options: TicketQueryOptions = {}): Promise<any> {
    const { startDate, endDate, includeRefunded = false } = options;

    const match: any = { shopId: new Types.ObjectId(shopId) };

    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = startDate;
      if (endDate) match.date.$lte = endDate;
    }

    if (!includeRefunded) match.refunded = false;

    const [summary, topItems, paymentMethods, staffPerformance, dailySales] = await Promise.all([
      // Overall summary
      Ticket.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            totalProfit: { $sum: "$totalProfit" },
            totalItemsSold: { $sum: "$totalItemCount" },
            totalTickets: { $sum: 1 },
            averageTicketValue: { $avg: "$totalAmount" },
          },
        },
      ]),

      // Top selling items
      Ticket.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.itemId",
            itemName: { $first: "$items.itemName" },
            quantitySold: { $sum: "$items.quantitySold" },
            revenue: { $sum: "$items.lineTotal" },
          },
        },
        { $sort: { quantitySold: -1 } },
        { $limit: 10 },
      ]),

      // Sales by payment method
      Ticket.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$paymentMethod",
            count: { $sum: 1 },
            amount: { $sum: "$totalAmount" },
          },
        },
      ]),

      // Sales by staff
      Ticket.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$soldBy",
            soldByName: { $first: "$soldByName" },
            ticketCount: { $sum: 1 },
            revenue: { $sum: "$totalAmount" },
            profit: { $sum: "$totalProfit" },
          },
        },
        { $sort: { revenue: -1 } },
      ]),

      // Daily sales trend
      Ticket.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$date" },
            },
            revenue: { $sum: "$totalAmount" },
            tickets: { $sum: 1 },
            itemsSold: { $sum: "$totalItemCount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Refunded tickets summary
    let refundedSummary: { refundedAmount: number; refundedCount: number } | null = null;
    if (includeRefunded) {
      const refundedMatch = { ...match, refunded: true };
      const refunded = await Ticket.aggregate([
        { $match: refundedMatch },
        {
          $group: {
            _id: null,
            refundedAmount: { $sum: "$totalAmount" },
            refundedCount: { $sum: 1 },
          },
        },
      ]);
      refundedSummary = refunded[0] || { refundedAmount: 0, refundedCount: 0 };
    }

    const result: any = {
      ...(summary[0] || {
        totalRevenue: 0,
        totalProfit: 0,
        totalItemsSold: 0,
        totalTickets: 0,
        averageTicketValue: 0,
      }),
      topSellingItems: topItems.map((item) => ({
        itemId: item._id.toString(),
        itemName: item.itemName,
        quantitySold: item.quantitySold,
        revenue: item.revenue,
      })),
      salesByPaymentMethod: paymentMethods.map((method) => ({
        method: method._id,
        count: method.count,
        amount: method.amount,
      })),
      salesByStaff: staffPerformance.map((staff) => ({
        staffId: staff._id.toString(),
        staffName: staff.soldByName,
        ticketCount: staff.ticketCount,
        revenue: staff.revenue,
        profit: staff.profit,
      })),
      dailySales: dailySales.map((day) => ({
        date: day._id,
        revenue: day.revenue,
        tickets: day.tickets,
        itemsSold: day.itemsSold,
      })),
    };

    if (refundedSummary) {
      result.refundedAmount = refundedSummary.refundedAmount;
      result.refundedCount = refundedSummary.refundedCount;
    }

    return result;
  }

  // Get total items sold for a specific item
  async getTotalSoldByItem(itemId: string): Promise<number> {
    const result = await Ticket.aggregate([
      { $match: { refunded: false } },
      { $unwind: "$items" },
      { $match: { "items.itemId": new Types.ObjectId(itemId) } },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$items.quantitySold" },
        },
      },
    ]);

    return result[0]?.totalQuantity || 0;
  }

  // Search tickets
  async search(
    shopId: string,
    searchTerm: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ tickets: ITicketSummary[]; total: number }> {
    const skip = (page - 1) * limit;

    const query = {
      shopId: new Types.ObjectId(shopId),
      $text: { $search: searchTerm },
    };

    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .select("ticketNumber totalAmount totalItemCount soldByName paymentMethod date isCredit creditStatus amountOwed refunded")
        .skip(skip)
        .limit(limit)
        .sort({ date: -1 })
        .lean(),
      Ticket.countDocuments(query),
    ]);

    return { tickets: tickets as unknown as ITicketSummary[], total };
  }

  // Delete ticket
  async delete(ticketId: string): Promise<void> {
    await Ticket.findByIdAndDelete(ticketId);
  }

  // Credit sales methods
  async findCreditTickets(
    shopId: string,
    options: TicketQueryOptions = {}
  ): Promise<{ tickets: ITicket[]; total: number; page: number; pages: number }> {
    const {
      creditStatus,
      customerPhone,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = "date",
      sortOrder = "desc",
    } = options;

    const query: any = {
      shopId: new Types.ObjectId(shopId),
      isCredit: true,
      refunded: false,
    };

    if (creditStatus) query.creditStatus = creditStatus;
    if (customerPhone) query.customerPhone = customerPhone;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [tickets, total] = await Promise.all([
      Ticket.find(query).skip(skip).limit(limit).sort(sort).lean(),
      Ticket.countDocuments(query),
    ]);

    return {
      tickets: tickets as unknown as ITicket[],
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async recordCreditPayment(
    ticketId: string,
    payment: ICreditPayment
  ): Promise<ITicket | null> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return null;

    const newAmountPaid = ticket.amountPaid + payment.amount;
    const newAmountOwed = ticket.totalAmount - newAmountPaid;

    let newStatus: "pending" | "partial" | "paid" = "pending";
    if (newAmountOwed <= 0) {
      newStatus = "paid";
    } else if (newAmountPaid > 0) {
      newStatus = "partial";
    }

    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticketId,
      {
        $push: { payments: payment },
        $set: {
          amountPaid: newAmountPaid,
          amountOwed: Math.max(0, newAmountOwed),
          creditStatus: newStatus,
        },
      },
      { new: true }
    );
    
    return updatedTicket as ITicket | null;
  }

  async getCreditSalesSummary(shopId: string): Promise<any> {
    const result = await Ticket.aggregate([
      {
        $match: {
          shopId: new Types.ObjectId(shopId),
          isCredit: true,
          refunded: false,
        },
      },
      {
        $group: {
          _id: "$creditStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          totalOwed: { $sum: "$amountOwed" },
          totalPaid: { $sum: "$amountPaid" },
        },
      },
    ]);

    const summary = {
      pending: { count: 0, totalAmount: 0, totalOwed: 0, totalPaid: 0 },
      partial: { count: 0, totalAmount: 0, totalOwed: 0, totalPaid: 0 },
      paid: { count: 0, totalAmount: 0, totalOwed: 0, totalPaid: 0 },
      overall: { count: 0, totalAmount: 0, totalOwed: 0, totalPaid: 0 },
    };

    result.forEach((item: any) => {
      summary[item._id as keyof typeof summary] = {
        count: item.count,
        totalAmount: item.totalAmount,
        totalOwed: item.totalOwed,
        totalPaid: item.totalPaid,
      };
      summary.overall.count += item.count;
      summary.overall.totalAmount += item.totalAmount;
      summary.overall.totalOwed += item.totalOwed;
      summary.overall.totalPaid += item.totalPaid;
    });

    return summary;
  }

  async getCustomerCreditHistory(
    shopId: string,
    customerPhone: string
  ): Promise<ITicket[]> {
    return await Ticket.find({
      shopId: new Types.ObjectId(shopId),
      customerPhone,
      isCredit: true,
      refunded: false,
    })
      .sort({ date: -1 })
      .lean() as unknown as ITicket[];
  }

  async getOverdueCreditTickets(shopId: string): Promise<ITicket[]> {
    return await Ticket.find({
      shopId: new Types.ObjectId(shopId),
      isCredit: true,
      creditStatus: { $in: ["pending", "partial"] },
      dueDate: { $lt: new Date() },
      refunded: false,
    })
      .sort({ dueDate: 1 })
      .lean() as unknown as ITicket[];
  }
}