import Sale from "../models/sales";
import { ICreditPayment, ISale, RecordCreditPaymentInput, SalesQueryOptions,} from "../types";
import { Types } from "mongoose";

export class SaleRepository {
  
  // create new sale record
   
  async create(data: Partial<ISale>): Promise<ISale> {
    return await Sale.create(data);
  }
  
// find sale by ID
  async findById(saleId: string): Promise<ISale | null> {
    return await Sale.findById(saleId)
      .populate("soldBy", "staffName phoneNumber")
      .populate("itemId", "name category");
  }
  
  // find sales by shop with filters and pagination
  async findByShopId(
    shopId: string,
    options: SalesQueryOptions = {}
  ): Promise<{ sales: ISale[]; total: number; page: number; pages: number }> {
    const {
      startDate,
      endDate,
      itemId,
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
  
    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
  
    // Item filter
    if (itemId) {
      query.itemId = new Types.ObjectId(itemId);
    }
  
    // Staff filter
    if (soldBy) {
      query.soldBy = new Types.ObjectId(soldBy);
    }
  
    // Payment method filter
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
  
    // Refunded filter
    if (!includeRefunded) {
      query.refunded = false;
    }
  
    // Credit sale filter
    if (typeof isCredit === "boolean") {
      query.isCredit = isCredit;
    }
  
    // Credit status filter
    if (creditStatus) {
      query.creditStatus = creditStatus;
    }
  
    const skip = (page - 1) * limit;
    const sort: any = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;
  
    const [sales, total] = await Promise.all([
      Sale.find(query)
        .populate("soldBy", "staffName")
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .lean(),
      Sale.countDocuments(query),
    ]);
  
    return {
      sales: sales as unknown as ISale[],
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // Update sale
  async update(saleId: string, updates: Partial<ISale>): Promise<ISale | null> {
    return await Sale.findByIdAndUpdate(saleId, updates, { new: true });
  }

  // Process refund
  async refund(
    saleId: string,
    refundedBy: string,
    reason: string
  ): Promise<ISale | null> {
    return await Sale.findByIdAndUpdate(
      saleId,
      {
        refunded: true,
        refundedAt: new Date(),
        refundedBy: new Types.ObjectId(refundedBy),
        refundReason: reason,
      },
      { new: true }
    );
  }

  // Get sales analytics
  async getAnalytics(shopId: string, options: SalesQueryOptions = {}): Promise<any> {
    const { startDate, endDate, includeRefunded = false } = options;

    const match: any = { shopId: new Types.ObjectId(shopId) };

    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = startDate;
      if (endDate) match.date.$lte = endDate;
    }

    if (!includeRefunded) {
      match.refunded = false;
    }

    const [summary, topItems, paymentMethods, staffPerformance, dailySales] = await Promise.all([
      // Overall summary
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            totalProfit: { $sum: "$profitAmount" },
            totalItemsSold: { $sum: "$quantitySold" },
            totalTransactions: { $sum: 1 },
            averageTransactionValue: { $avg: "$totalAmount" },
          },
        },
      ]),

      // Top selling items
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$itemId",
            itemName: { $first: "$itemName" },
            quantitySold: { $sum: "$quantitySold" },
            revenue: { $sum: "$totalAmount" },
          },
        },
        { $sort: { quantitySold: -1 } },
        { $limit: 10 },
      ]),

      // Sales by payment method
      Sale.aggregate([
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
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$soldBy",
            soldByName: { $first: "$soldByName" },
            salesCount: { $sum: 1 },
            revenue: { $sum: "$totalAmount" },
            profit: { $sum: "$profitAmount" },
          },
        },
        { $sort: { revenue: -1 } },
      ]),

      // Daily sales trend
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$date" },
            },
            revenue: { $sum: "$totalAmount" },
            transactions: { $sum: 1 },
            itemsSold: { $sum: "$quantitySold" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Refunded sales summary
    let refundedSummary: { refundedAmount: number; refundedCount: number } | null = null;
    if (includeRefunded) {
      const refundedMatch = { ...match, refunded: true };
      const refunded = await Sale.aggregate([
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
        totalTransactions: 0,
        averageTransactionValue: 0,
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
        salesCount: staff.salesCount,
        revenue: staff.revenue,
        profit: staff.profit,
      })),
      dailySales: dailySales.map((day) => ({
        date: day._id,
        revenue: day.revenue,
        transactions: day.transactions,
        itemsSold: day.itemsSold,
      })),
    };

    if (refundedSummary) {
      result.refundedAmount = refundedSummary.refundedAmount;
      result.refundedCount = refundedSummary.refundedCount;
    }

    return result;
  }

  // Get total sales for a specific item
  async getTotalSalesByItem(itemId: string): Promise<number> {
    const result = await Sale.aggregate([
      {
        $match: {
          itemId: new Types.ObjectId(itemId),
          refunded: false,
        },
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantitySold" },
        },
      },
    ]);

    return result[0]?.totalQuantity || 0;
  }

  // Search sales
  async search(
    shopId: string,
    searchTerm: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ sales: ISale[]; total: number }> {
    const skip = (page - 1) * limit;

    const query = {
      shopId: new Types.ObjectId(shopId),
      $text: { $search: searchTerm },
    };

    const [sales, total] = await Promise.all([
      Sale.find(query).skip(skip).limit(limit).sort({ date: -1 }).lean(),
      Sale.countDocuments(query),
    ]);

    return { sales: sales as unknown as ISale[], total };
  }

  // Delete sale (soft delete by marking as refunded)
  async delete(saleId: string): Promise<void> {
    await Sale.findByIdAndDelete(saleId);
  }

  // Find credit sales by shop
async findCreditSales(
  shopId: string,
  options: SalesQueryOptions = {}
): Promise<{ sales: ISale[]; total: number; page: number; pages: number }> {
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

  const [sales, total] = await Promise.all([
    Sale.find(query).skip(skip).limit(limit).sort(sort).lean(),
    Sale.countDocuments(query),
  ]);

  return {
    sales: sales as unknown as ISale[],
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

// Record credit payment
async recordCreditPayment(
  saleId: string,
  payment: ICreditPayment
): Promise<ISale | null> {
  const sale = await Sale.findById(saleId);
  if (!sale) return null;

  const newAmountPaid = sale.amountPaid + payment.amount;
  const newAmountOwed = sale.totalAmount - newAmountPaid;

  let newStatus: "pending" | "partial" | "paid" = "pending";
  if (newAmountOwed <= 0) {
    newStatus = "paid";
  } else if (newAmountPaid > 0) {
    newStatus = "partial";
  }

  return await Sale.findByIdAndUpdate(
    saleId,
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
}

// Get credit sales summary
async getCreditSalesSummary(shopId: string): Promise<any> {
  const result = await Sale.aggregate([
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

// Get customer credit history
async getCustomerCreditHistory(
  shopId: string,
  customerPhone: string
): Promise<ISale[]> {
  return await Sale.find({
    shopId: new Types.ObjectId(shopId),
    customerPhone,
    isCredit: true,
    refunded: false,
  })
    .sort({ date: -1 })
    .lean() as unknown as ISale[];
}

// Get overdue credit sales
async getOverdueCreditSales(shopId: string): Promise<ISale[]> {
  return await Sale.find({
    shopId: new Types.ObjectId(shopId),
    isCredit: true,
    creditStatus: { $in: ["pending", "partial"] },
    dueDate: { $lt: new Date() },
    refunded: false,
  })
    .sort({ dueDate: 1 })
    .lean() as unknown as ISale[];
}
}