import Inventory from "../models/Inventory";
import StockMovementModel from "../models/stockMovement";
import { IInventoryItem, InventoryQueryOptions, StockMovement } from "../types";
import { Types } from "mongoose";

export class InventoryRepository {
  /**
   * Create new inventory item
   */
  async create(data: Partial<IInventoryItem>): Promise<IInventoryItem> {
    return await Inventory.create(data);
  }

  /**
   * Find item by ID
   */
  async findById(itemId: string): Promise<IInventoryItem | null> {
    return await Inventory.findById(itemId);
  }

  /**
   * Find item by SKU
   */
  async findBySKU(shopId: string, sku: string): Promise<IInventoryItem | null> {
    return await Inventory.findOne({
      shopId: new Types.ObjectId(shopId),
      sku: sku.toUpperCase(),
    });
  }

  /**
   * Find item by barcode
   */
  async findByBarcode(
    shopId: string,
    barcode: string
  ): Promise<IInventoryItem | null> {
    return await Inventory.findOne({
      shopId: new Types.ObjectId(shopId),
      barcode,
    });
  }

  /**
   * Find item by name (case-insensitive)
   */
  async findByName(
    shopId: string,
    name: string
  ): Promise<IInventoryItem | null> {
    return await Inventory.findOne({
      shopId: new Types.ObjectId(shopId),
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
  }

  /**
   * Find all items for a shop with filters
   */
  async findByShopId(
    shopId: string,
    options: InventoryQueryOptions = {}
  ): Promise<{
    items: IInventoryItem[];
    total: number;
    page: number;
    pages: number;
  }> {
    const {
      category,
      subCategory,
      isActive,
      isLowStock,
      isOutOfStock,
      search,
      tags,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const query: any = { shopId: new Types.ObjectId(shopId) };

    // Category filter
    if (category) {
      query.category = category;
    }

    // Sub-category filter
    if (subCategory) {
      query.subCategory = subCategory;
    }

    // Active filter
    if (typeof isActive === "boolean") {
      query.isActive = isActive;
    }

    // Low stock filter
    if (typeof isLowStock === "boolean") {
      query.isLowStock = isLowStock;
    }

    // Out of stock filter
    if (typeof isOutOfStock === "boolean") {
      query.isOutOfStock = isOutOfStock;
    }

    // Search filter
    if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    query.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },  // ← The 'i' flag!
      { description: { $regex: escapedSearch, $options: 'i' } },
      { sku: { $regex: escapedSearch, $options: 'i' } },
      { category: { $regex: escapedSearch, $options: 'i' } },
      { subCategory: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

    // Tags filter
    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.sellingPrice = {};
      if (minPrice !== undefined) query.sellingPrice.$gte = minPrice;
      if (maxPrice !== undefined) query.sellingPrice.$lte = maxPrice;
    }

    const skip = (page - 1) * limit;
    const sort: any = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [items, total] = await Promise.all([
      Inventory.find(query).skip(skip).limit(limit).sort(sort).lean(),
      Inventory.countDocuments(query),
    ]);

    return {
      items: items as unknown as IInventoryItem[],
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Update item
   */
  async update(
    itemId: string,
    updates: Partial<IInventoryItem>
  ): Promise<IInventoryItem | null> {
    return await Inventory.findByIdAndUpdate(itemId, updates, { new: true });
  }

  /**
   * Delete item
   */
  async delete(itemId: string): Promise<void> {
    await Inventory.findByIdAndDelete(itemId);
  }

  /**
   * Soft delete (deactivate)
   */
  async deactivate(itemId: string): Promise<IInventoryItem | null> {
    return await Inventory.findByIdAndUpdate(
      itemId,
      { isActive: false },
      { new: true }
    );
  }

  /**
   * Reactivate item
   */
  async reactivate(itemId: string): Promise<IInventoryItem | null> {
    return await Inventory.findByIdAndUpdate(
      itemId,
      { isActive: true },
      { new: true }
    );
  }

  /**
   * Update stock quantity (for sales)
   */
  async reduceStock(
    itemId: string,
    quantity: number
  ): Promise<IInventoryItem | null> {
    return await Inventory.findByIdAndUpdate(
      itemId,
      {
        $inc: {
          availableQuantity: -quantity,
          soldQuantity: quantity,
        },
        lastSold: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Restore stock (for refunds)
   */
  async restoreStock(
    itemId: string,
    quantity: number
  ): Promise<IInventoryItem | null> {
    return await Inventory.findByIdAndUpdate(
      itemId,
      {
        $inc: {
          availableQuantity: quantity,
          soldQuantity: -quantity,
        },
      },
      { new: true }
    );
  }

  /**
   * Restock item
   */
  async restock(
    itemId: string,
    quantity: number,
    costPrice?: number
  ): Promise<IInventoryItem | null> {
    const updates: any = {
      $inc: { availableQuantity: quantity },
      lastRestocked: new Date(),
    };

    if (costPrice !== undefined) {
      updates.costPrice = costPrice;
    }

    return await Inventory.findByIdAndUpdate(itemId, updates, { new: true });
  }

  /**
   * Adjust stock (for damages, losses, etc.)
   */
  async adjustStock(
    itemId: string,
    quantity: number,
    reason: "damaged" | "expired" | "lost" | "found" | "returned" | "correction"
  ): Promise<IInventoryItem | null> {
    const incUpdates: any = { availableQuantity: quantity };

    // Track different adjustment types
    if (reason === "damaged") {
      incUpdates.damagedQuantity = Math.abs(quantity);
    } else if (reason === "returned") {
      incUpdates.returnedQuantity = Math.abs(quantity);
    }

    const updates: any = {
      $inc: incUpdates,
    };

    return await Inventory.findByIdAndUpdate(itemId, updates, { new: true });
  }

  /**
   * Record stock movement
   */
  async recordStockMovement(
    movement: Partial<StockMovement>
  ): Promise<StockMovement> {
    return await StockMovementModel.create(movement);
  }

  /**
   * Get stock movements for an item
   */
  async getStockMovements(
    itemId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ movements: StockMovement[]; total: number }> {
    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      StockMovementModel.find({ itemId: new Types.ObjectId(itemId) })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StockMovementModel.countDocuments({ itemId: new Types.ObjectId(itemId) }),
    ]);

    return { movements: movements as unknown as StockMovement[], total };
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(shopId: string): Promise<IInventoryItem[]> {
    return (await Inventory.find({
      shopId: new Types.ObjectId(shopId),
      isLowStock: true,
      isActive: true,
    })
      .sort({ availableQuantity: 1 })
      .lean()) as unknown as IInventoryItem[];
  }

  /**
   * Get out of stock items
   */
  async getOutOfStockItems(shopId: string): Promise<IInventoryItem[]> {
    return (await Inventory.find({
      shopId: new Types.ObjectId(shopId),
      isOutOfStock: true,
      isActive: true,
    }).lean()) as unknown as IInventoryItem[];
  }

  /**
   * Get expiring items (within next N days)
   */
  async getExpiringItems(
    shopId: string,
    days: number = 30
  ): Promise<IInventoryItem[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return (await Inventory.find({
      shopId: new Types.ObjectId(shopId),
      expiryDate: { $lte: futureDate, $gte: new Date() },
      isActive: true,
    })
      .sort({ expiryDate: 1 })
      .lean()) as unknown as IInventoryItem[];
  }

  /**
   * Get categories with item counts
   */
  async getCategories(
    shopId: string
  ): Promise<Array<{ category: string; count: number }>> {
    return await Inventory.aggregate([
      {
        $match: {
          shopId: new Types.ObjectId(shopId),
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  /**
   * Get inventory analytics
   */
  async getAnalytics(shopId: string): Promise<any> {
    const [summary, categoryBreakdown, topSelling, slowMoving] =
      await Promise.all([
        // Overall summary
        Inventory.aggregate([
          {
            $match: {
              shopId: new Types.ObjectId(shopId),
              isActive: true,
            },
          },
          {
            $group: {
              _id: null,
              totalItems: { $sum: 1 },
              totalValue: {
                $sum: { $multiply: ["$availableQuantity", "$costPrice"] },
              },
              totalRetailValue: {
                $sum: { $multiply: ["$availableQuantity", "$sellingPrice"] },
              },
              lowStockItems: {
                $sum: { $cond: ["$isLowStock", 1, 0] },
              },
              outOfStockItems: {
                $sum: { $cond: ["$isOutOfStock", 1, 0] },
              },
            },
          },
        ]),

        // Category breakdown
        Inventory.aggregate([
          {
            $match: {
              shopId: new Types.ObjectId(shopId),
              isActive: true,
            },
          },
          {
            $group: {
              _id: "$category",
              itemCount: { $sum: 1 },
              totalValue: {
                $sum: { $multiply: ["$availableQuantity", "$costPrice"] },
              },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              itemCount: 1,
              totalValue: 1,
            },
          },
          { $sort: { totalValue: -1 } },
        ]),

        // Top selling items
        Inventory.aggregate([
          {
            $match: {
              shopId: new Types.ObjectId(shopId),
              isActive: true,
              soldQuantity: { $gt: 0 },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              soldQuantity: 1,
              revenue: { $multiply: ["$soldQuantity", "$sellingPrice"] },
            },
          },
          { $sort: { soldQuantity: -1 } },
          { $limit: 10 },
        ]),

        // Slow moving items
        Inventory.aggregate([
          {
            $match: {
              shopId: new Types.ObjectId(shopId),
              isActive: true,
              availableQuantity: { $gt: 0 },
              soldQuantity: { $lt: 5 }, // Sold less than 5 units
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              availableQuantity: 1,
              lastSold: 1,
              soldQuantity: 1,
            },
          },
          { $sort: { soldQuantity: 1 } },
          { $limit: 10 },
        ]),
      ]);

    const result = summary[0] || {
      totalItems: 0,
      totalValue: 0,
      totalRetailValue: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
    };

    // Get expiring items count
    const expiringItems = await this.getExpiringItems(shopId, 30);

    return {
      ...result,
      potentialProfit: result.totalRetailValue - result.totalValue,
      expiringItems: expiringItems.length,
      categoryBreakdown,
      topSellingItems: topSelling.map((item: any) => ({
        itemId: item._id.toString(),
        name: item.name,
        soldQuantity: item.soldQuantity,
        revenue: item.revenue,
      })),
      slowMovingItems: slowMoving.map((item: any) => ({
        itemId: item._id.toString(),
        name: item.name,
        availableQuantity: item.availableQuantity,
        lastSold: item.lastSold,
      })),
    };
  }

  /**
   * Check if SKU exists
   */
  async skuExists(
    shopId: string,
    sku: string,
    excludeItemId?: string
  ): Promise<boolean> {
    const query: any = {
      shopId: new Types.ObjectId(shopId),
      sku: sku.toUpperCase(),
    };

    if (excludeItemId) {
      query._id = { $ne: new Types.ObjectId(excludeItemId) };
    }

    const item = await Inventory.findOne(query);
    return !!item;
  }

  /**
   * Check if barcode exists
   */
  async barcodeExists(
    shopId: string,
    barcode: string,
    excludeItemId?: string
  ): Promise<boolean> {
    const query: any = {
      shopId: new Types.ObjectId(shopId),
      barcode,
    };

    if (excludeItemId) {
      query._id = { $ne: new Types.ObjectId(excludeItemId) };
    }

    const item = await Inventory.findOne(query);
    return !!item;
  }

  /**
   * Check if item belongs to shop
   */
  async itemBelongsToShop(itemId: string, shopId: string): Promise<boolean> {
    const item = await Inventory.findOne({
      _id: new Types.ObjectId(itemId),
      shopId: new Types.ObjectId(shopId),
    });
    return !!item;
  }
}
