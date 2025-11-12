import bcrypt from "bcryptjs";
import { StaffRepository } from "../repositories/staff.repository";
import { ShopRepository } from "../repositories/shop.repository";
import { logStaffAuditEvent } from "../utils/auditLogger";
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
  InternalServerError,
} from "../../../shared/utils/AppError";
import {
  CreateStaffInput,
  UpdateStaffInput,
  StaffQueryOptions,
  RequestMetadata,
  IStaff,
} from "../types";

// Constants
const MAX_STAFF_PER_SHOP = 5;
const PASSWORD_HASH_ROUNDS = 12;

export class StaffService {
  private staffRepository: StaffRepository;
  private shopRepository: ShopRepository;

  constructor() {
    this.staffRepository = new StaffRepository();
    this.shopRepository = new ShopRepository();
  }

 
   // Validate shop ownership
  
  private async validateShopOwnership(
    shopId: string,
    userShopId: string,
    userRole: "owner" | "staff"
  ): Promise<void> {
    // Only owners can manage staff
    if (userRole !== "owner") {
      throw new AuthorizationError("Only shop owners can manage staff members");
    }

    // Verify user's shopId matches the requested shopId
    if (userShopId !== shopId) {
      throw new AuthorizationError("You can only manage staff for your own shop");
    }

    // Verify shop exists and is verified
    const shopExists = await this.shopRepository.existsAndVerified(shopId);
    if (!shopExists) {
      throw new NotFoundError("Shop not found or not verified");
    }
  }

 
// Create new staff member   
  async createStaff(
    input: CreateStaffInput,
    metadata: RequestMetadata
  ): Promise<IStaff> {
    const { shopId, staffName, phoneNumber, password, role = "staff" } = input;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Validate shop ownership
    await this.validateShopOwnership(shopId, userShopId, userRole);

    // Check staff limit
    const currentStaffCount = await this.staffRepository.countByShopId(shopId, false);
    if (currentStaffCount >= MAX_STAFF_PER_SHOP) {
      await logStaffAuditEvent({
        requestId,
        action: "STAFF_CREATE_LIMIT_EXCEEDED",
        shopId,
        performedBy: { userId, role: userRole },
        ip,
        details: { currentCount: currentStaffCount },
      });
      throw new ValidationError(
        `Maximum staff limit (${MAX_STAFF_PER_SHOP}) reached for this shop`
      );
    }


    //need to include a method to verfiy these phonenumbers for the staff
    // Check if phone number already exists for this shop
    const phoneExists = await this.staffRepository.phoneNumberExistsForOtherStaff(
      shopId,
      phoneNumber
    );
    if (phoneExists) {
      await logStaffAuditEvent({
        requestId,
        action: "STAFF_CREATE_DUPLICATE_PHONE",
        shopId,
        performedBy: { userId, role: userRole },
        ip,
        details: { phoneNumber },
      });
      throw new ConflictError("Phone number already registered for another staff member in this shop");
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

    // Create staff
    let staff;
    try {
      staff = await this.staffRepository.create({
        shopId,
        staffName,
        phoneNumber,
        passwordHash,
        role,
      });
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictError("Phone number already registered in this shop");
      }
      throw error;
    }

    await logStaffAuditEvent({
      requestId,
      action: "STAFF_CREATED",
      shopId,
      performedBy: { userId, role: userRole },
      targetStaffId: staff._id.toString(),
      ip,
      details: { staffName, phoneNumber, role },
    });

    return staff;
  }

// Get all staff for a shop  
  async getStaffList(
    shopId: string,
    options: StaffQueryOptions,
    metadata: RequestMetadata
  ): Promise<{ staff: IStaff[]; total: number; page: number; pages: number }> {
    const { requestId, userId, userRole, userShopId } = metadata;

    // Validate shop ownership
    await this.validateShopOwnership(shopId, userShopId, userRole);

    const result = await this.staffRepository.findByShopId(shopId, options);

    await logStaffAuditEvent({
      requestId,
      action: "STAFF_LIST_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      details: { count: result.staff.length, filters: options },
    });

    return result;
  }

 // Get single staff member   
  async getStaffById(
    staffId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<IStaff> {
    const { requestId, userId, userRole, userShopId } = metadata;

    // Validate shop ownership
    await this.validateShopOwnership(shopId, userShopId, userRole);

    const staff = await this.staffRepository.findById(staffId);

    if (!staff) {
      throw new NotFoundError("Staff member not found");
    }

    // Verify staff belongs to this shop
    if (staff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    await logStaffAuditEvent({
      requestId,
      action: "STAFF_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
      targetStaffId: staffId,
    });

    return staff;
  }

// Update staff member
  async updateStaff(
    staffId: string,
    shopId: string,
    updates: UpdateStaffInput,
    metadata: RequestMetadata
  ): Promise<IStaff> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Validate shop ownership
    await this.validateShopOwnership(shopId, userShopId, userRole);

    // Find existing staff
    const existingStaff = await this.staffRepository.findById(staffId);
    if (!existingStaff) {
      throw new NotFoundError("Staff member not found");
    }

    // Verify staff belongs to this shop
    if (existingStaff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    // Prepare update object
    const updateData: any = {};

    if (updates.staffName !== undefined) {
      updateData.staffName = updates.staffName;
    }

    if (updates.phoneNumber !== undefined) {
      // Check if new phone number conflicts with another staff
      if (updates.phoneNumber !== existingStaff.phoneNumber) {
        const phoneExists = await this.staffRepository.phoneNumberExistsForOtherStaff(
          shopId,
          updates.phoneNumber,
          staffId
        );
        if (phoneExists) {
          throw new ConflictError("Phone number already in use by another staff member");
        }
        updateData.phoneNumber = updates.phoneNumber;
      }
    }

    if (updates.password !== undefined) {
      updateData.passwordHash = await bcrypt.hash(updates.password, PASSWORD_HASH_ROUNDS);
    }

    if (updates.role !== undefined) {
      updateData.role = updates.role;
    }

    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive;
    }

    // Update staff
    const updatedStaff = await this.staffRepository.update(staffId, updateData);

    if (!updatedStaff) {
      throw new NotFoundError("Staff member not found after update");
    }

    await logStaffAuditEvent({
      requestId,
      action: "STAFF_UPDATED",
      shopId,
      performedBy: { userId, role: userRole },
      targetStaffId: staffId,
      ip,
      details: {
        updates: Object.keys(updateData),
        oldPhone: existingStaff.phoneNumber,
        newPhone: updates.phoneNumber,
      },
    });

    return updatedStaff;
  }

  
//Deactivate staff member (soft delete)
  async deactivateStaff(
    staffId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<IStaff> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Validate shop ownership
    await this.validateShopOwnership(shopId, userShopId, userRole);

    // Find staff
    const staff = await this.staffRepository.findById(staffId);
    if (!staff) {
      throw new NotFoundError("Staff member not found");
    }

    // Verify staff belongs to this shop
    if (staff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    // Deactivate
    const deactivatedStaff = await this.staffRepository.deactivate(staffId);

    if (!deactivatedStaff) {
      throw new NotFoundError("Staff member not found");
    }

    await logStaffAuditEvent({
      requestId,
      action: "STAFF_DEACTIVATED",
      shopId,
      performedBy: { userId, role: userRole },
      targetStaffId: staffId,
      ip,
      details: { staffName: staff.staffName, phoneNumber: staff.phoneNumber },
    });

    return deactivatedStaff;
  }

// Permanently delete staff member 
  async deleteStaff(
    staffId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<void> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Validate shop ownership
    await this.validateShopOwnership(shopId, userShopId, userRole);

    // Find staff
    const staff = await this.staffRepository.findById(staffId);
    if (!staff) {
      throw new NotFoundError("Staff member not found");
    }

    // Verify staff belongs to this shop
    if (staff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    // Delete
    await this.staffRepository.delete(staffId);

    await logStaffAuditEvent({
      requestId,
      action: "STAFF_DELETED",
      shopId,
      performedBy: { userId, role: userRole },
      targetStaffId: staffId,
      ip,
      details: { staffName: staff.staffName, phoneNumber: staff.phoneNumber },
    });
  }

// Reactivate staff member
  async reactivateStaff(
    staffId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<IStaff> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Validate shop ownership
    await this.validateShopOwnership(shopId, userShopId, userRole);

    // Find staff
    const staff = await this.staffRepository.findById(staffId);
    if (!staff) {
      throw new NotFoundError("Staff member not found");
    }

    // Verify staff belongs to this shop
    if (staff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    // Check staff limit before reactivating
    const activeStaffCount = await this.staffRepository.countByShopId(shopId, true);
    if (activeStaffCount >= MAX_STAFF_PER_SHOP) {
      throw new ValidationError(
        `Cannot reactivate. Maximum staff limit (${MAX_STAFF_PER_SHOP}) reached`
      );
    }

    // Reactivate
    const reactivatedStaff = await this.staffRepository.reactivate(staffId);

    if (!reactivatedStaff) {
      throw new NotFoundError("Staff member not found");
    }

    await logStaffAuditEvent({
      requestId,
      action: "STAFF_REACTIVATED",
      shopId,
      performedBy: { userId, role: userRole },
      targetStaffId: staffId,
      ip,
      details: { staffName: staff.staffName },
    });

    return reactivatedStaff;
  }

// Get staff statistics for a shop
  async getStaffStatistics(
    shopId: string,
    metadata: RequestMetadata
  ): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
    availableSlots: number;
  }> {
    const { requestId, userId, userRole, userShopId } = metadata;

    // Validate shop ownership
    await this.validateShopOwnership(shopId, userShopId, userRole);

    const [allStaff] = await Promise.all([
      this.staffRepository.findByShopId(shopId, {
        includeInactive: true,
        limit: 100,
      }),
    ]);

    const active = allStaff.staff.filter((s) => s.isActive).length;
    const inactive = allStaff.total - active;

    const byRole: Record<string, number> = {};
    allStaff.staff.forEach((staff) => {
      byRole[staff.role] = (byRole[staff.role] || 0) + 1;
    });

    await logStaffAuditEvent({
      requestId,
      action: "STAFF_STATISTICS_VIEWED",
      shopId,
      performedBy: { userId, role: userRole },
    });

    return {
      total: allStaff.total,
      active,
      inactive,
      byRole,
      availableSlots: Math.max(0, MAX_STAFF_PER_SHOP - active),
    };
  }
}