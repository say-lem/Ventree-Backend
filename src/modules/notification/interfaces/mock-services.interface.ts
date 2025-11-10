import { StaffPermissions } from './mock-auth.interface';

/**
 * Mock Shop Service Interface
 * This will be replaced with real ShopService when available
 */
export interface IMockShopService {
  validateShopExists(shopId: number): Promise<boolean>;
  getShopOwner(shopId: number): Promise<number>;
}

/**
 * Mock Staff Service Interface
 * This will be replaced with real StaffService when available
 */
export interface IMockStaffService {
  validateStaffBelongsToShop(staffId: number, shopId: number): Promise<boolean>;
  getStaffPermissions(staffId: number): Promise<StaffPermissions>;
}

/**
 * Mock Inventory Service Interface
 * This will be replaced with real InventoryService when available
 */
export interface IMockInventoryService {
  getProductById(inventoryId: number): Promise<{ id: number; name: string; quantity: number } | null>;
}

/**
 * Mock Sales Service Interface
 * This will be replaced with real SalesService when available
 */
export interface IMockSalesService {
  getSaleById(saleId: string): Promise<{ id: string; total: number; itemCount: number } | null>;
}
