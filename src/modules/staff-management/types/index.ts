import { Document, Types } from "mongoose";

export interface IStaff extends Document {
  _id: Types.ObjectId;
  shopId: Types.ObjectId;
  staffName: string;
  phoneNumber: string;
  passwordHash: string;
  role: "cashier" | "manager" | "inventory" | "staff";
  isActive: boolean;
  createdAt: Date;
  isOwner: boolean;
  updatedAt: Date;
  lastLoginAt?: Date;
  failedLoginAttempts?: number;
  lockoutUntil?: Date;
}

export interface CreateStaffInput {
  shopId: string;
  staffName: string;
  phoneNumber: string;
  password: string;
  role?: "cashier" | "manager" | "inventory" | "staff";
}

export interface UpdateStaffInput {
  staffName?: string;
  phoneNumber?: string;
  password?: string;
  role?: "cashier" | "manager" | "inventory" | "staff";
  isActive?: boolean;
}

export interface StaffQueryOptions {
  includeInactive?: boolean;
  role?: string;
  page?: number;
  limit?: number;
}

export interface RequestMetadata {
  ip: string;
  requestId: string;
  userId: string;
  userRole: "owner" | "staff";
  userShopId: string;
}