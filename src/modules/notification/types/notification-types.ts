/**
 * Notification Type Enumeration
 * Defines all possible notification types in the system
 */
export enum NotificationType {
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  SALE_COMPLETED = 'sale_completed',
  INVENTORY_UPDATED = 'inventory_updated',
  STAFF_CREATED = 'staff_created',
  STAFF_DELETED = 'staff_deleted',
  EXPENSE_ADDED = 'expense_added',
  SYSTEM_ALERT = 'system',
  CUSTOM = 'custom',
}

/**
 * Notification Payload Interface
 * Generic payload structure for notifications
 */
export interface NotificationPayload {
  type: NotificationType;
  data: Record<string, any>;
}

/**
 * Low Stock Notification Data
 */
export interface LowStockData {
  productName: string;
  quantity: number;
  unit: string;
  threshold: number;
  inventoryId: number;
}

/**
 * Out of Stock Notification Data
 */
export interface OutOfStockData {
  productName: string;
  inventoryId: number;
}

/**
 * Sale Completed Notification Data
 */
export interface SaleCompletedData {
  saleId: string;
  itemCount: number;
  total: number;
  currency: string;
  staffName?: string;
}

/**
 * Inventory Updated Notification Data
 */
export interface InventoryUpdatedData {
  productName: string;
  oldQuantity: number;
  newQuantity: number;
  unit: string;
  updatedBy: string;
  inventoryId: number;
}

/**
 * Staff Action Notification Data
 */
export interface StaffActionData {
  staffName: string;
  action: 'created' | 'deleted' | 'updated';
  performedBy: string;
}

/**
 * System Alert Notification Data
 */
export interface SystemAlertData {
  alertType: 'warning' | 'error' | 'info';
  message: string;
  details?: string;
}

/**
 * Recipient Type for Notifications
 */
export type RecipientType = 'owner' | 'staff' | 'all';
