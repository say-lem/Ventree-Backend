import { Router } from "express";
import {
  authenticate,
  ownerAndManager,
  ownerOnly,
  verifyShopAccess,
} from "../../../shared/middleware/auth.middleware";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import {
  expensesCreateValidation,
  expensesUpdateValidation,
  expensesDeleteValidation,
  shopIdParamValidation,
  filterExpensesValidation,
  getExpensesValidation,
} from "../validators/expenses.validator";
import {
  createExpenseController,
  getExpensesController,
  getFilteredExpensesController,
  getSingleExpenseController,
  getTotalExpensesController,
  updateExpenseController,
  deleteExpenseController,
} from "../controllers/expenses.controller";

const router = Router();

// Note
// - Your Validation should come before your authentication middleware,
// - I removed the staff check on your controller and lookup since they could be checked with the user role
// - Utilize your ownerOnly middleware more often to reduce redundancy / stress

// CREATE EXPENSE (manager only)
router.post(
  "/",
  authenticate,
  expensesCreateValidation,
  validateRequest,
  createExpenseController
);

// ─────────────────────────────────────────────
// LIST ALL EXPENSES
// ─────────────────────────────────────────────
// ✅ UPDATE THIS ROUTE - Add getExpensesValidation
router.get(
  "/:shopId",
  authenticate,
  getExpensesValidation, // ← CHANGED from shopIdParamValidation
  validateRequest, // ← ADD validateRequest
  getExpensesController
);

// ─────────────────────────────────────────────
// FILTERED EXPENSES (today, week, month)
// ─────────────────────────────────────────────
router.get(
  "/:shopId/filter",
  authenticate,
  filterExpensesValidation,
  getFilteredExpensesController
);

// ─────────────────────────────────────────────
// TOTAL EXPENSES (today, week, month, total)
// ─────────────────────────────────────────────
router.get(
  "/:shopId/total",
  authenticate,
  shopIdParamValidation,
  getTotalExpensesController
);

// ─────────────────────────────────────────────
// GET SINGLE EXPENSE
// ─────────────────────────────────────────────
router.get(
  "/:shopId/:expenseId",
  authenticate,
  shopIdParamValidation,
  getSingleExpenseController
);

// ─────────────────────────────────────────────
// UPDATE EXPENSE (manager + owner)
// ─────────────────────────────────────────────
router.patch(
  "/:shopId/:expenseId",
  authenticate,
  ownerAndManager,
  expensesUpdateValidation,
  updateExpenseController
);

// ─────────────────────────────────────────────
// DELETE EXPENSE (owner only)
// ─────────────────────────────────────────────
router.delete(
  "/:shopId/:expenseId",
  authenticate,
  ownerOnly,
  expensesDeleteValidation,
  deleteExpenseController
);

export { router as expensesRouter };
