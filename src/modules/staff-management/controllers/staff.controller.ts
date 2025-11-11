import { Response } from "express";
import { validationResult } from "express-validator";
import { StaffService } from "../services/staff.service";
import crypto from "crypto";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { ValidationError, AuthenticationError } from "../../../shared/utils/AppError";
import { AuthenticatedRequest } from "../../../shared/middleware/auth.middleware";

const staffService = new StaffService();

/**
 * @route POST /staff
 * @desc Create new staff member
 */
export const createStaff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, staffName, phoneNumber, password, role } = req.body;

  const staff = await staffService.createStaff(
    { shopId, staffName, phoneNumber, password, role },
    {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.profileId,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    }
  );

  res.status(201).json({
    success: true,
    message: "Staff member created successfully",
    data: staff,
  });
});

/**
 * @route GET /staff/:shopId
 * @desc Get all staff for a shop
 */
export const getStaffList = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;
  const {
    includeInactive = "false",
    role,
    page = "1",
    limit = "10",
  } = req.query;

  const result = await staffService.getStaffList(
    shopId,
    {
      includeInactive: includeInactive === "true",
      role: role as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    },
    {
      requestId,
      ip: req.ip || "unknown",
      userId: req.user.profileId,
      userRole: req.user.role,
      userShopId: req.user.shopId,
    }
  );

  res.status(200).json({
    success: true,
    message: "Staff list retrieved successfully",
    data: result,
  });
});

/**
 * @route GET /staff/:shopId/:staffId
 * @desc Get single staff member
 */
export const getStaffById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, staffId } = req.params;

  const staff = await staffService.getStaffById(staffId, shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Staff member retrieved successfully",
    data: staff,
  });
});

/**
 * @route PUT /staff/:shopId/:staffId
 * @desc Update staff member
 */
export const updateStaff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, staffId } = req.params;
  const updates = req.body;

  const staff = await staffService.updateStaff(staffId, shopId, updates, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Staff member updated successfully",
    data: staff,
  });
});

/**
 * @route DELETE /staff/:shopId/:staffId
 * @desc Deactivate staff member (soft delete)
 */
export const deactivateStaff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, staffId } = req.params;

  const staff = await staffService.deactivateStaff(staffId, shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Staff member deactivated successfully",
    data: staff,
  });
});

/**
 * @route DELETE /staff/:shopId/:staffId/permanent
 * @desc Permanently delete staff member
 */
export const deleteStaff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, staffId } = req.params;

  await staffService.deleteStaff(staffId, shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Staff member permanently deleted",
  });
});

/**
 * @route POST /staff/:shopId/:staffId/reactivate
 * @desc Reactivate deactivated staff member
 */
export const reactivateStaff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, staffId } = req.params;

  const staff = await staffService.reactivateStaff(staffId, shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Staff member reactivated successfully",
    data: staff,
  });
});

/**
 * @route GET /staff/:shopId/statistics
 * @desc Get staff statistics for a shop
 */
export const getStaffStatistics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;

  const statistics = await staffService.getStaffStatistics(shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Staff statistics retrieved successfully",
    data: statistics,
  });
});