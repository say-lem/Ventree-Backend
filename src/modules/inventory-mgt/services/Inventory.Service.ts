import { InventoryRepository } from "../repository/inventory.repository";
import { ShopRepository } from "../repository/shop.repository";
import { logInventoryAuditEvent } from "../utils/auditLogger";
import { generateSKU } from "../utils/skuGenerator";
import { Types } from "mongoose";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
  InternalServerError,
} from "../../../shared/utils/AppError";
import {
  CreateInventoryInput,
  UpdateInventoryInput,
  RestockInput,
  AdjustStockInput,
  InventoryQueryOptions,
  RequestMetadata,
  IInventoryItem,
  InventoryAnalytics,
} from "../types";

export class InventoryService {
  private inventoryRepository: InventoryRepository;
  private shopRepository: ShopRepository;

  constructor() {
    this.inventoryRepository = new InventoryRepository();
    this.shopRepository = new ShopRepository();
  }

 // Validate shop access
  private async validateShopAccess(
    shopId: string,
    userShopId: string,
    userRole: "owner" | "staff"
  ): Promise<void> {
    if (userShopId !== shopId) {
      throw new AuthorizationError("You can only access inventory for your own shop");
    }

    const shopExists = await this.shopRepository.existsAndVerified(shopId);
    if (!shopExists) {
      throw new NotFoundError("Shop not found or not verified");
    }
  }

  // Create new inventory item
  async createItem(
    input: CreateInventoryInput,
    metadata: RequestMetadata
  ): Promise<IInventoryItem> {
    const { shopId, name, category, sku, barcode, costPrice, sellingPrice, initialQuantity } = input;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Validate shop access
    await this.validateShopAccess(shopId, userShopId, userRole);

    // Only owners can add products
    if (userRole !== "owner") {
      throw new AuthorizationError("Only shop owners can add inventory items");
    }

    // Validate pricing
    if (costPrice < 0 || sellingPrice < 0) {
      throw new ValidationError("Prices cannot be negative");
    }

    if (sellingPrice < costPrice) {
      throw new ValidationError("Selling price cannot be less than cost price");
    }

    // Check if item name already exists
    const existingByName = await this.inventoryRepository.findByName(shopId, name);
    if (existingByName) {
      throw new ConflictError("Product with this name already exists in your inventory");
    }

    // Generate SKU if not provided
    let finalSKU = sku;
    if (!finalSKU) {
      finalSKU = generateSKU(category);
      // Ensure uniqueness
      while (await this.inventoryRepository.skuExists(shopId, finalSKU)) {
        finalSKU = generateSKU(category);
      }
    } else {
      // Check if provided SKU already exists
      if (await this.inventoryRepository.skuExists(shopId, finalSKU)) {
        throw new ConflictError("SKU already exists in your inventory");
      }
    }

    // Check if barcode already exists
    // if (barcode) {
    //   if (await this.inventoryRepository.barcodeExists(shopId, barcode)) {
    //     throw new ConflictError("Barcode already exists in your inventory");
    //   }
    // }

    // Create item
    const item = await this.inventoryRepository.create({
      ...input,
      shopId: new Types.ObjectId(shopId),
      sku: finalSKU,
      availableQuantity: initialQuantity,
      createdBy: new Types.ObjectId(userId),
    });

    await logInventoryAuditEvent({
      requestId,
      action: "INVENTORY_ITEM_CREATED",
      shopId,
      performedBy: { userId, role: userRole },
      itemId: item._id.toString(),
      ip,
      details: {
        name,
        sku: finalSKU,
        initialQuantity,
        costPrice,
        sellingPrice,
      },
    });

    return item;
  }

  // Get inventory list
  async getInventoryList(
    shopId: string,
    options: InventoryQueryOptions,
    metadata: RequestMetadata
  ): Promise<{ items: IInventoryItem[]; total: number; page: number; pages: number }> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const result = await this.inventoryRepository.findByShopId(shopId, options);

    await logInventoryAuditEvent({
      requestId,
      action: "INVENTORY_LIST_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: result.items.length, filters: options },
    });

    return result;
  }

  // Get single item by ID
  async getItemById(
    itemId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<IInventoryItem> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const item = await this.inventoryRepository.findById(itemId);

    if (!item) {
      throw new NotFoundError("Inventory item not found");
    }

    if (item.shopId.toString() !== shopId) {
      throw new AuthorizationError("Item does not belong to this shop");
    }

    await logInventoryAuditEvent({
      requestId,
      action: "INVENTORY_ITEM_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      itemId,
    });

    return item;
  }

  // Update inventory item
  async updateItem(
    itemId: string,
    shopId: string,
    updates: UpdateInventoryInput,
    metadata: RequestMetadata
  ): Promise<IInventoryItem> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Only owners can update items
    if (userRole !== "owner") {
      throw new AuthorizationError("Only shop owners can update inventory items");
    }

    await this.validateShopAccess(shopId, userShopId, userRole);

    const existingItem = await this.inventoryRepository.findById(itemId);
    if (!existingItem) {
      throw new NotFoundError("Inventory item not found");
    }

    if (existingItem.shopId.toString() !== shopId) {
      throw new AuthorizationError("Item does not belong to this shop");
    }

    // Validate pricing if being updated
    if (updates.costPrice !== undefined || updates.sellingPrice !== undefined) {
      const newCostPrice = updates.costPrice ?? existingItem.costPrice;
      const newSellingPrice = updates.sellingPrice ?? existingItem.sellingPrice;

      if (newCostPrice < 0 || newSellingPrice < 0) {
        throw new ValidationError("Prices cannot be negative");
      }

      if (newSellingPrice < newCostPrice) {
        throw new ValidationError("Selling price cannot be less than cost price");
      }
    }

    // Check if barcode update conflicts
    // if (updates.barcode && updates.barcode !== existingItem.barcode) {
    //   if (await this.inventoryRepository.barcodeExists(shopId, updates.barcode, itemId)) {
    //     throw new ConflictError("Barcode already exists in your inventory");
    //   }
    // }

    const updatedItem = await this.inventoryRepository.update(itemId, {
      ...updates,
      updatedBy: new Types.ObjectId(userId),
    });

    if (!updatedItem) {
      throw new NotFoundError("Item not found after update");
    }

    await logInventoryAuditEvent({
      requestId,
      action: "INVENTORY_ITEM_UPDATED",
      shopId,
      performedBy: { userId, role: userRole },
      itemId,
      ip,
      details: {
        updates: Object.keys(updates),
        oldName: existingItem.name,
        newName: updates.name,
      },
    });

    return updatedItem;
  }

  /**
   * Delete inventory item
   */
  async deleteItem(
    itemId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<void> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Only owners can delete items
    if (userRole !== "owner") {
      throw new AuthorizationError("Only shop owners can delete inventory items");
    }

    await this.validateShopAccess(shopId, userShopId, userRole);

    const item = await this.inventoryRepository.findById(itemId);
    if (!item) {
      throw new NotFoundError("Inventory item not found");
    }

    if (item.shopId.toString() !== shopId) {
      throw new AuthorizationError("Item does not belong to this shop");
    }

    // Prevent deletion if item has stock
    if (item.availableQuantity > 0) {
      throw new ValidationError(
        "Cannot delete item with available stock. Please reduce stock to zero first."
      );
    }

    await this.inventoryRepository.delete(itemId);

    await logInventoryAuditEvent({
      requestId,
      action: "INVENTORY_ITEM_DELETED",
      shopId,
      performedBy: { userId, role: userRole },
      itemId,
      ip,
      details: {
        name: item.name,
        sku: item.sku,
      },
    });
  }

 // Restock item
  async restockItem(
    itemId: string,
    shopId: string,
    restockData: RestockInput,
    metadata: RequestMetadata
  ): Promise<IInventoryItem> {
    const { quantity, costPrice, notes } = restockData;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    if (quantity <= 0) {
      throw new ValidationError("Restock quantity must be greater than zero");
    }

    const item = await this.inventoryRepository.findById(itemId);
    if (!item) {
        throw new NotFoundError("Inventory item not found");
    }

    if (item.shopId.toString() !== shopId) {
      throw new AuthorizationError("Item does not belong to this shop");
    }

    const beforeQuantity = item.availableQuantity;
    const updatedItem = await this.inventoryRepository.restock(itemId, quantity, costPrice);

    if (!updatedItem) {
      throw new NotFoundError("Item not found after restock");
    }

    // Record stock movement
    await this.inventoryRepository.recordStockMovement({
      itemId: item._id,
      itemName: item.name,
      type: "restock",
      quantity,
      beforeQuantity,
      afterQuantity: updatedItem.availableQuantity,
      notes,
      performedBy: new Types.ObjectId(userId),
      performedByName: userRole === "owner" ? "Owner" : "Staff",
      date: new Date(),
    });

    await logInventoryAuditEvent({
      requestId,
      action: "INVENTORY_RESTOCKED",
      shopId,
      performedBy: { userId, role: userRole },
      itemId,
      ip,
      details: {
        name: item.name,
        quantity,
        beforeQuantity,
        afterQuantity: updatedItem.availableQuantity,
        costPrice,
      },
    });

    return updatedItem;
  }

  //Adjust stock (for damages, corrections, etc.)
  async adjustStock(
    itemId: string,
    shopId: string,
    adjustData: AdjustStockInput,
    metadata: RequestMetadata
  ): Promise<IInventoryItem> {
    const { quantity, reason, notes } = adjustData;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    if (quantity === 0) {
      throw new ValidationError("Adjustment quantity cannot be zero");
    }

    const item = await this.inventoryRepository.findById(itemId);
    if (!item) {
      throw new NotFoundError("Inventory item not found");
    }

    if (item.shopId.toString() !== shopId) {
      throw new AuthorizationError("Item does not belong to this shop");
    }

    // Check if reducing stock would result in negative quantity
    if (quantity < 0 && Math.abs(quantity) > item.availableQuantity) {
      throw new ValidationError(
        `Adjustment would result in negative stock. Requested: ${Math.abs(quantity)}, Available: ${item.availableQuantity}`
      );
    }

    const beforeQuantity = item.availableQuantity;
    const updatedItem = await this.inventoryRepository.adjustStock(itemId, quantity, reason);

    if (!updatedItem) {
      throw new NotFoundError("Item not found after adjustment");
    }

    // Record stock movement
    await this.inventoryRepository.recordStockMovement({
      itemId: item._id,
      itemName: item.name,
      type: "adjustment",
      quantity,
      beforeQuantity,
      afterQuantity: updatedItem.availableQuantity,
      reason,
      notes,
      performedBy: new Types.ObjectId(userId),
      performedByName: userRole === "owner" ? "Owner" : "Staff",
      date: new Date(),
    });

    await logInventoryAuditEvent({
      requestId,
      action: "INVENTORY_ADJUSTED",
      shopId,
      performedBy: { userId, role: userRole },
      itemId,
      ip,
      details: {
        name: item.name,
        quantity,
        reason,
        beforeQuantity,
        afterQuantity: updatedItem.availableQuantity,
      },
    });

    return updatedItem;
  }

 // Reduce stock (called by sales service)
  async reduceStock(
    itemId: string,
    quantity: number,
    shopId?: string
  ): Promise<IInventoryItem | null> {
    const item = await this.inventoryRepository.findById(itemId);
    if (!item) {
      throw new NotFoundError("Inventory item not found");
    }

    if (shopId && item.shopId.toString() !== shopId) {
      throw new AuthorizationError("Item does not belong to this shop");
    }

    if (quantity > item.availableQuantity) {
      throw new ValidationError(
        `Insufficient stock available. Requested: ${quantity}, Available: ${item.availableQuantity}`
      );
    }

    return await this.inventoryRepository.reduceStock(itemId, quantity);
  }

  // Restore stock (called by sales service for refunds)
  async restoreStock(itemId: string, quantity: number): Promise<IInventoryItem | null> {
    return await this.inventoryRepository.restoreStock(itemId, quantity);
  }

  //Get low stock items
  async getLowStockItems(shopId: string, metadata: RequestMetadata): Promise<IInventoryItem[]> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const items = await this.inventoryRepository.getLowStockItems(shopId);

    await logInventoryAuditEvent({
      requestId,
      action: "LOW_STOCK_ITEMS_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: items.length },
    });

    return items;
  }

  // Get out of stock items
  async getOutOfStockItems(shopId: string, metadata: RequestMetadata): Promise<IInventoryItem[]> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const items = await this.inventoryRepository.getOutOfStockItems(shopId);

    await logInventoryAuditEvent({
      requestId,
      action: "OUT_OF_STOCK_ITEMS_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: items.length },
    });

    return items;
  }

  // Get expiring items
  async getExpiringItems(
    shopId: string,
    days: number,
    metadata: RequestMetadata
  ): Promise<IInventoryItem[]> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const items = await this.inventoryRepository.getExpiringItems(shopId, days);

    await logInventoryAuditEvent({
      requestId,
      action: "EXPIRING_ITEMS_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: items.length, days },
    });

    return items;
  }

  //Get inventory analytics
  async getAnalytics(shopId: string, metadata: RequestMetadata): Promise<InventoryAnalytics> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const analytics = await this.inventoryRepository.getAnalytics(shopId);

    await logInventoryAuditEvent({
      requestId,
      action: "INVENTORY_ANALYTICS_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
    });

    return analytics;
  }

  // Get categories
  async getCategories(shopId: string, metadata: RequestMetadata): Promise<Array<{ category: string; count: number }>> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    const categories = await this.inventoryRepository.getCategories(shopId);

    await logInventoryAuditEvent({
      requestId,
      action: "INVENTORY_CATEGORIES_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
    });

    return categories;
  }

  // Get stock movements for an item
  async getStockMovements(
    itemId: string,
    shopId: string,
    page: number,
    limit: number,
    metadata: RequestMetadata
  ): Promise<{ movements: any[]; total: number }> {
    const { requestId, userId, userRole, userShopId } = metadata;

    await this.validateShopAccess(shopId, userShopId, userRole);

    // Verify item belongs to shop
    const itemBelongs = await this.inventoryRepository.itemBelongsToShop(itemId, shopId);
    if (!itemBelongs) {
      throw new AuthorizationError("Item does not belong to this shop");
    }

    const result = await this.inventoryRepository.getStockMovements(itemId, page, limit);

    await logInventoryAuditEvent({
      requestId,
      action: "STOCK_MOVEMENTS_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      itemId,
    });

    return result;
  }

  // Check if item has sufficient stock (used by sales service)
  async hasStock(itemId: string, quantity: number): Promise<boolean> {
    const item = await this.inventoryRepository.findById(itemId);
    if (!item) return false;
    return item.availableQuantity >= quantity;
  }

  // Check if item belongs to shop (used by sales service)
  async itemBelongsToShop(itemId: string, shopId: string): Promise<boolean> {
    return await this.inventoryRepository.itemBelongsToShop(itemId, shopId);
  }
}