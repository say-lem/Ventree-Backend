import { InventoryItem } from "../types";

export const InventoryService = {
  async getItemById(itemId: string): Promise<InventoryItem | null> {
    // Temporary mock data
    return {
      _id: itemId,
      name: "Mock Product",
      sku: "MP-001",
      availableQuantity: 50,
      costPrice: 1200,
      sellingPrice: 1500,
    };
  },

  async reduceStock(itemId: string, quantity: number): Promise<boolean> {
    console.log(`[MockInventory] Reduced ${quantity} units of ${itemId}`);
    return true;
  },
};

