import { Types } from "mongoose";
import Expense from "../../expenses/models/expenses";

export class AnalyticsRepository {
  async getExpensesTotal(shopId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const match: any = {
      shopId: new Types.ObjectId(shopId),
    };
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = startDate;
    }
    if (endDate) {
      dateFilter.$lte = endDate;
    }
    if (Object.keys(dateFilter).length > 0) {
      match.createdAt = dateFilter;
    }
    const result = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);
    return result[0]?.total || 0;
  }

  async getExpensesByCategory(
    shopId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ category: string; total: number }>> {
    const match: any = {
      shopId: new Types.ObjectId(shopId),
    };
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = startDate;
    }
    if (endDate) {
      dateFilter.$lte = endDate;
    }
    if (Object.keys(dateFilter).length > 0) {
      match.createdAt = dateFilter;
    }
    const result = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          total: 1,
        },
      },
      { $sort: { total: -1 } },
    ]);
    return result as Array<{ category: string; total: number }>;
  }
}
