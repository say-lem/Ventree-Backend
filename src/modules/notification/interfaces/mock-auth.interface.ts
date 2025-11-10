/**
 * Mock Auth Context Interface
 * This will be replaced with real AuthService when available
 */
export interface MockAuthContext {
  userId: number;
  shopId: number;
  role: 'ownerProfile' | 'staff';
  profileId: number;  // ownerProfileId or staffId
  replicaId: string;  // CRDT replica identifier
}

/**
 * Staff Permissions Interface
 * Based on the permissions table in the entity diagram
 */
export interface StaffPermissions {
  staffId: number;
  inventory: boolean;
  sales: boolean;
  expenses: boolean;
  analytics: boolean;
  staffManagement: boolean;
  notifications: boolean;
}
