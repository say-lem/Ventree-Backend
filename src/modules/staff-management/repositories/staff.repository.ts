import Staff from "../models/staff";
import { IStaff, StaffQueryOptions } from "../types";
import { Types } from "mongoose";

export class StaffRepository {
   // Find staff by ID
  async findById(staffId: string): Promise<IStaff | null> {
    return await Staff.findById(staffId);
  }

   // Find staff by ID with password  
  async findByIdWithPassword(staffId: string): Promise<IStaff | null> {
    return await Staff.findById(staffId).select("+passwordHash");
  }

  //Find staff by ID with OTP hash
  async findByIdWithOTP(staffId: string): Promise<IStaff | null> {
    return await Staff.findById(staffId).select("+otpHash");
  }

   //Find staff by shop ID and phone number
  async findByShopAndPhone(
    shopId: string,
    phoneNumber: string
  ): Promise<IStaff | null> {
    return await Staff.findOne({
      shopId: new Types.ObjectId(shopId),
      phoneNumber,
    });
  }

   //Find all staff for a shop with filters
  async findByShopId(
    shopId: string,
    options: StaffQueryOptions = {}
  ): Promise<{ staff: IStaff[]; total: number; page: number; pages: number }> {
    const {
      includeInactive = false,
      role,
      page = 1,
      limit = 10,
    } = options;

    const query: any = { shopId: new Types.ObjectId(shopId) };

    if (!includeInactive) {
      query.isActive = true;
    }

    if (role) {
      query.role = role;
    }

    const skip = (page - 1) * limit;

    const [staff, total] = await Promise.all([
      Staff.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Staff.countDocuments(query),
    ]);

    return {
      staff,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
  
   // Count staff for a shop
   async countByShopId(shopId: string, activeOnly: boolean = true): Promise<number> {
    const query: any = { shopId: new Types.ObjectId(shopId) };
    if (activeOnly) {
      query.isActive = true;
    }
    return await Staff.countDocuments(query);
  }

   //Create new staff member
  async create(data: {
    shopId: string;
    staffName: string;
    phoneNumber: string;
    passwordHash: string;
    role: string;
  }): Promise<IStaff> {
    return await Staff.create({
      ...data,
      shopId: new Types.ObjectId(data.shopId),
    });
  }

 //Update staff member
  async update(
    staffId: string,
    updates: Partial<IStaff>
  ): Promise<IStaff | null> {
    return await Staff.findByIdAndUpdate(staffId, updates, { new: true });
  }

  // Soft delete (deactivate) staff member
  async deactivate(staffId: string): Promise<IStaff | null> {
    return await Staff.findByIdAndUpdate(
      staffId,
      { isActive: false },
      { new: true }
    );
  }
  
  // Hard delete staff member
  async delete(staffId: string): Promise<void> {
    await Staff.findByIdAndDelete(staffId);
  }

  //Reactivate staff member
  async reactivate(staffId: string): Promise<IStaff | null> {
    return await Staff.findByIdAndUpdate(
      staffId,
      { isActive: true },
      { new: true }
    );
  }

  //Check if phone number exists for another staff in the same shop
  async phoneNumberExistsForOtherStaff(
    shopId: string,
    phoneNumber: string,
    excludeStaffId?: string
  ): Promise<boolean> {
    const query: any = {
      shopId: new Types.ObjectId(shopId),
      phoneNumber,
    };

    if (excludeStaffId) {
      query._id = { $ne: new Types.ObjectId(excludeStaffId) };
    }

    const staff = await Staff.findOne(query);
    return !!staff;
  }

  // Update last login time
  async updateLastLogin(staffId: string): Promise<void> {
    await Staff.findByIdAndUpdate(staffId, {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockoutUntil: null,
    });
  }

 // Increment failed login attempts
  async incrementFailedLoginAttempts(staffId: string): Promise<void> {
    await Staff.findByIdAndUpdate(staffId, {
      $inc: { failedLoginAttempts: 1 },
    });
  }

  // Lock account after too many failed attempts
  async lockAccount(staffId: string, lockoutDuration: number): Promise<void> {
    await Staff.findByIdAndUpdate(staffId, {
      lockoutUntil: new Date(Date.now() + lockoutDuration),
    });
  }
}