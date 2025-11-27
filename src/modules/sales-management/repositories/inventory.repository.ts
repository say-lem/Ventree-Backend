import Inventory from "../../inventory-mgt/models/Inventory";
import StockMovementModel from "../../inventory-mgt/models/stockMovement";
import { Types } from "mongoose";
import { IInventoryItem } from "../../inventory-mgt/types";

export class InventoryRepository {
  /**
   * Get item by ID
   */
  async findById(itemId: string): Promise<IInventoryItem | null> {
    return await Inventory.findById(itemId);
  }

  /**
   * Check if item has sufficient stock
   */
  async hasStock(itemId: string, quantity: number): Promise<boolean> {
    const item = await Inventory.findById(itemId);
    if (!item) return false;
    return item.availableQuantity >= quantity;
  }

  /**
   * Reduce stock (decrement available quantity)
   * Uses atomic operation with optimistic concurrency control
   */
  async reduceStock(
    itemId: string,
    quantity: number,
    performedBy?: string,
    performedByName?: string
  ): Promise<IInventoryItem | null> {
    // Use findOneAndUpdate with a condition to ensure atomic operation
    // and prevent overselling
    const item = await Inventory.findOneAndUpdate(
      {
        _id: new Types.ObjectId(itemId),
        availableQuantity: { $gte: quantity }, // Ensure sufficient stock
      },
      {
        $inc: {
          availableQuantity: -quantity,
          soldQuantity: quantity,
        },
        $set: {
          lastSold: new Date(),
        },
      },
      { new: true }
    );

    if (!item) {
      throw new Error("Insufficient stock or item not found");
    }

    // Record stock movement if performer info provided
    if (performedBy && performedByName) {
      await this.recordStockMovement({
        itemId,
        itemName: item.name,
        type: "sale",
        quantity: -quantity,
        beforeQuantity: item.availableQuantity + quantity,
        afterQuantity: item.availableQuantity,
        performedBy,
        performedByName,
      });
    }

    return item;
  }

  /**
   * Restore stock (increment available quantity - for refunds)
   */
  async restoreStock(
    itemId: string,
    quantity: number,
    performedBy?: string,
    performedByName?: string
  ): Promise<IInventoryItem | null> {
    const item = await Inventory.findByIdAndUpdate(
      itemId,
      {
        $inc: {
          availableQuantity: quantity,
          returnedQuantity: quantity,
          soldQuantity: -quantity,
        },
      },
      { new: true }
    );

    if (!item) {
      throw new Error("Item not found");
    }

    // Record stock movement if performer info provided
    if (performedBy && performedByName) {
      await this.recordStockMovement({
        itemId,
        itemName: item.name,
        type: "return",
        quantity: quantity,
        beforeQuantity: item.availableQuantity - quantity,
        afterQuantity: item.availableQuantity,
        performedBy,
        performedByName,
        reason: "Sale refund",
      });
    }

    return item;
  }

  /**
   * Check if item belongs to shop
   */
  async itemBelongsToShop(itemId: string, shopId: string): Promise<boolean> {
    const item = await Inventory.findOne({
      _id: new Types.ObjectId(itemId),
      shopId: new Types.ObjectId(shopId),
      isActive: true,
    });
    return !!item;
  }

  /**
   * Get item with shop validation
   */
  async findByIdAndShop(
    itemId: string,
    shopId: string
  ): Promise<IInventoryItem | null> {
    return await Inventory.findOne({
      _id: new Types.ObjectId(itemId),
      shopId: new Types.ObjectId(shopId),
    });
  }

  /**
   * Record stock movement for audit trail
   */
  private async recordStockMovement(data: {
    itemId: string;
    itemName: string;
    type: "sale" | "restock" | "adjustment" | "damage" | "return";
    quantity: number;
    beforeQuantity: number;
    afterQuantity: number;
    performedBy: string;
    performedByName: string;
    reason?: string;
    notes?: string;
  }): Promise<void> {
    await StockMovementModel.create({
      itemId: new Types.ObjectId(data.itemId),
      itemName: data.itemName,
      type: data.type,
      quantity: data.quantity,
      beforeQuantity: data.beforeQuantity,
      afterQuantity: data.afterQuantity,
      performedBy: new Types.ObjectId(data.performedBy),
      performedByName: data.performedByName,
      reason: data.reason,
      notes: data.notes,
      date: new Date(),
    });
  }
}