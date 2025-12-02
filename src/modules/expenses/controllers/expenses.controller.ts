import {
  createExpenseService,
  getExpensesService,
  getFilteredExpensesService,
  getSingleExpenseService,
  updateExpenseService,
  deleteExpenseService,
  getTotalExpensesService
} from "../services/expenses.service";
import { validationResult } from "express-validator";
import { Request, Response } from "express";
import { ValidationError } from "../../../shared/utils/AppError";



// CREATE EXPENSE
export const createExpenseController = async (req: Request, res: Response) => {
  
  try {
    const { shopId, staffId, amount, title, category, notes } = req.body;
    const authUser = req.user
    const uploader = staffId || shopId

    const expense = await createExpenseService({ shopId, staffId, authUser, amount, title, category, notes, uploader });

    return res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ============================================
// CHANGES TO: controllers/expenses.controller.ts
// ============================================

// ✅ REPLACE getExpensesController with this updated version
export const getExpensesController = async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      category,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    // Call service with all parameters
    const result = await getExpensesService({ 
      shopId, 
      reqUser: req.user,
      page: Number(page),
      limit: Number(limit),
      category: category as string,
      startDate: startDate as string,
      endDate: endDate as string,
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc"
    });

    return res.status(200).json({ 
      success: true, 
      data: result.expenses,
      pagination: result.pagination 
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// Keep all other controllers unchanged...


// GET FILTERED EXPENSES (today | week | month)
export const getFilteredExpensesController = async (req: Request, res: Response) => {
  try {
    const { shopId, staffId } = req.body;
    const { filter } = req.query;

    if (!filter || !["today", "week", "month"].includes(filter as string)) {
      throw new ValidationError("Invalid filter. Must be 'today', 'week', or 'month'");
    }

    const expenses = await getFilteredExpensesService({ shopId, staffId, filter: filter as string });

    return res.status(200).json({ success: true, data: expenses });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// GET SINGLE EXPENSE
export const getSingleExpenseController = async (req: Request, res: Response) => {
  try {
    const { shopId, expenseId } = req.params;

    const expense = await getSingleExpenseService({ shopId, expenseId, reqUser: req.user });

    return res.status(200).json({ success: true, data: expense });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// UPDATE EXPENSE
export const updateExpenseController = async (req: Request, res: Response) => {
  try {
    const { shopId, expenseId } = req.params;
    const updateData = req.body;
    const updatedExpense = await updateExpenseService({ shopId, expenseId, updateData, reqUser: req.user });

    return res.status(200).json({ success: true, data: updatedExpense });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// DELETE EXPENSE
export const deleteExpenseController = async (req: Request, res: Response) => {
  try {
    const { shopId, expenseId } = req.params;

    const result = await deleteExpenseService({ shopId, expenseId, reqUser: req.user });

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


export const getTotalExpensesController = async (req, res, next) => {
  try {
    const { shopId, staffId } = req.params;
    const totals = await getTotalExpensesService({ shopId, staffId, reqUser: req.user });
    return res.status(200).json({ success: true, data: totals });
  } catch (err) {
    next(err);
  }
};
