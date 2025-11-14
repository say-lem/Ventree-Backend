import express from "express";
import {
  createStaff,
  getStaffList,
  getStaffById,
  updateStaff,
  deactivateStaff,
  deleteStaff,
  reactivateStaff,
  getStaffStatistics,
} from "../controllers/staff.controller";
import {
  createStaffValidation,
  updateStaffValidation,
  staffIdValidation,
  shopIdValidation,
  listStaffValidation,
} from "../validators/staff.validator";
import { authenticate } from "../../../shared/middleware/auth.middleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create staff
router.post("/", createStaffValidation, createStaff);

// Get staff statistics
router.get("/:shopId/statistics", shopIdValidation, getStaffStatistics);

// Get all staff for a shop (with pagination and filters)
router.get("/:shopId", listStaffValidation, getStaffList);

// Get single staff member
router.get("/:shopId/:staffId", shopIdValidation, staffIdValidation, getStaffById);

// Update staff member
router.put("/:shopId/:staffId", updateStaffValidation, updateStaff);

// Deactivate staff (soft delete)
router.delete("/:shopId/:staffId", shopIdValidation, staffIdValidation, deactivateStaff);

// Permanently delete staff
router.delete(
  "/:shopId/:staffId/permanent",
  shopIdValidation,
  staffIdValidation,
  deleteStaff
);

// Reactivate staff
router.post(
  "/:shopId/:staffId/reactivate",
  shopIdValidation,
  staffIdValidation,
  reactivateStaff
);

export default router;