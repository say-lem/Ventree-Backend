import bcrypt from "bcryptjs";
import { StaffRepository } from "../repositories/staff.repository";
import { ShopRepository } from "../repositories/shop.repository";
import { generateOTP, sendOTP } from "../../auth/utils/otpHandler";
import { hashOTP, verifyOTP } from "../../auth/utils/otpHash";
import { logStaffAuditEvent } from "../utils/auditLogger";
import { normalizePhoneNumber } from "../utils/phoneNormalizer";
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
  InternalServerError,
  RateLimitError,
} from "../../../shared/utils/AppError";
import {
  CreateStaffInput,
  UpdateStaffInput,
  StaffQueryOptions,
  RequestMetadata,
  IStaff,
} from "../types";
import Staff from "../models/staff";

// Constants
const MAX_STAFF_PER_SHOP = 5;
const PASSWORD_HASH_ROUNDS = 12;
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN = 60 * 1000; // 60 seconds between OTP sends

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

 
  /**
   * Send OTP to staff member
   */
  private async sendOTPToStaff(
    staff: IStaff,
    metadata: RequestMetadata
  ): Promise<void> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Check OTP cooldown
    if (staff.lastOTPSentAt) {
      const timeSinceLastOTP = Date.now() - staff.lastOTPSentAt.getTime();
      if (timeSinceLastOTP < OTP_COOLDOWN) {
        const waitTime = Math.ceil((OTP_COOLDOWN - timeSinceLastOTP) / 1000);
        throw new RateLimitError(
          `Please wait ${waitTime} seconds before requesting a new OTP.`,
          waitTime
        );
      }
    }

    // Generate and hash OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY);

    // Update staff with OTP hash and expiry
    await this.staffRepository.update(staff._id.toString(), {
      otpHash,
      otpExpiresAt,
      lastOTPSentAt: new Date(),
    } as any);

    // Send OTP
    try {
      await sendOTP(staff.phoneNumber, otp);
    } catch (sendError) {
      // Rollback OTP fields if sending fails
      await this.staffRepository.update(staff._id.toString(), {
        otpHash: undefined,
        otpExpiresAt: undefined,
      } as any);
      throw new InternalServerError("Failed to send OTP. Please try again.");
    }

    // Log OTP sent event
    await logStaffAuditEvent({
      requestId,
      action: "STAFF_OTP_SENT",
      shopId: userShopId,
      performedBy: { userId, role: userRole },
      targetStaffId: staff._id.toString(),
      ip,
      details: { phoneNumber: staff.phoneNumber },
    });
  }

  /**
   * Create new staff member
   */
  async createStaff(
    input: CreateStaffInput,
    metadata: RequestMetadata
  ): Promise<IStaff> {
    const { shopId, staffName, phoneNumber, password, role = "staff" } = input;
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Validate shop ownership
    await this.validateShopOwnership(shopId, userShopId, userRole);

    // Normalize phone number
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phoneNumber);
    } catch (error) {
      throw new ValidationError(
        error instanceof Error ? error.message : "Invalid phone number format"
      );
    }

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

    // Check if phone number already exists for this shop (using normalized phone)
    const phoneExists = await this.staffRepository.phoneNumberExistsForOtherStaff(
      shopId,
      normalizedPhone
    );
    if (phoneExists) {
      await logStaffAuditEvent({
        requestId,
        action: "STAFF_CREATE_DUPLICATE_PHONE",
        shopId,
        performedBy: { userId, role: userRole },
        ip,
        details: { phoneNumber: normalizedPhone },
      });
      throw new ConflictError("Phone number already registered for another staff member in this shop");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY);

    // Create staff
    let staff: IStaff;
    try {
      staff = await this.staffRepository.create({
        shopId,
        staffName,
        phoneNumber: normalizedPhone,
        passwordHash,
        role,
        otpHash,
        otpExpiresAt,
        lastOTPSentAt: new Date(),
        isVerified: false,
      } as any);
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictError("Phone number already registered in this shop");
      }
      throw error;
    }

    // Send OTP
    try {
      await sendOTP(normalizedPhone, otp);
    } catch (sendError) {
      // Rollback: delete the staff if OTP sending fails
      await Staff.findByIdAndDelete(staff._id);
      throw new InternalServerError("Failed to send OTP. Please try again.");
    }

    await logStaffAuditEvent({
      requestId,
      action: "STAFF_CREATED",
      shopId,
      performedBy: { userId, role: userRole },
      targetStaffId: staff._id.toString(),
      ip,
      details: { staffName, phoneNumber: normalizedPhone, role },
    });

    return staff;
  }

  /**
   * Verify staff phone number with OTP
   */
  async verifyStaffPhone(
    staffId: string,
    shopId: string,
    otp: string,
    metadata: RequestMetadata
  ): Promise<IStaff> {
    const { requestId, userId, userRole, ip, userShopId } = metadata;

    // Validate shop ownership
    await this.validateShopOwnership(shopId, userShopId, userRole);

    // Find staff with OTP hash
    const staff = await this.staffRepository.findByIdWithOTP(staffId);
    if (!staff) {
      throw new NotFoundError("Staff member not found");
    }

    // Verify staff belongs to this shop
    if (staff.shopId.toString() !== shopId) {
      throw new AuthorizationError("Staff member does not belong to this shop");
    }

    // Check if OTP exists and is not expired
    if (!staff.otpHash || !staff.otpExpiresAt) {
      throw new ValidationError("No OTP found. Please request a new one.");
    }

    if (staff.otpExpiresAt < new Date()) {
      // Clear expired OTP
      await this.staffRepository.update(staffId, {
        otpHash: undefined,
        otpExpiresAt: undefined,
      } as any);
      throw new ValidationError("OTP has expired. Please request a new one.");
    }

    // Verify OTP
    const isValid = await verifyOTP(otp, staff.otpHash);
    if (!isValid) {
      throw new ValidationError("Incorrect OTP.");
    }

    // Mark as verified and clear OTP
    const verifiedStaff = await this.staffRepository.update(staffId, {
      isVerified: true,
      otpHash: undefined,
      otpExpiresAt: undefined,
    } as any);

    if (!verifiedStaff) {
      throw new NotFoundError("Staff member not found after verification");
    }

    await logStaffAuditEvent({
      requestId,
      action: "STAFF_PHONE_VERIFIED",
      shopId,
      performedBy: { userId, role: userRole },
      targetStaffId: staffId,
      ip,
      details: { phoneNumber: staff.phoneNumber },
    });

    return verifiedStaff;
  }

  /**
   * Resend OTP to staff member
   */
  async resendOTPToStaff(
    staffId: string,
    shopId: string,
    metadata: RequestMetadata
  ): Promise<void> {
    const { requestId, userId, userRole, userShopId } = metadata;

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

    // Check if already verified
    if (staff.isVerified) {
      throw new ValidationError("Staff phone number is already verified.");
    }

    // Send OTP
    await this.sendOTPToStaff(staff, metadata);
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
      // Normalize phone number
      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneNumber(updates.phoneNumber);
      } catch (error) {
        throw new ValidationError(
          error instanceof Error ? error.message : "Invalid phone number format"
        );
      }

      // Check if new phone number conflicts with another staff
      if (normalizedPhone !== existingStaff.phoneNumber) {
        const phoneExists = await this.staffRepository.phoneNumberExistsForOtherStaff(
          shopId,
          normalizedPhone,
          staffId
        );
        if (phoneExists) {
          throw new ConflictError("Phone number already in use by another staff member");
        }
        updateData.phoneNumber = normalizedPhone;
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