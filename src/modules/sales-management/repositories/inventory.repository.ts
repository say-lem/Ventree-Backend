import Inventory from "../../inventory-mgt/models/Inventory";
import { Types } from "mongoose";

export class InventoryRepository {
  /**
   * Get item by ID
   */
  async findById(itemId: string) {
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
   */
  async reduceStock(itemId: string, quantity: number): Promise<void> {
    await Inventory.findByIdAndUpdate(
      itemId,
      {
        $inc: { availableQuantity: -quantity },
      },
      { new: true }
    );
  }

  /**
   * Restore stock (increment available quantity - for refunds)
   */
  async restoreStock(itemId: string, quantity: number): Promise<void> {
    await Inventory.findByIdAndUpdate(
      itemId,
      {
        $inc: { availableQuantity: quantity },
      },
      { new: true }
    );
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