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
    console.log("Creating expense with body:", req.body);
    const { shopId, staffId, amount, title, category, notes } = req.body;
    const authUser = req.user
    const uploader = staffId || shopId

    const expense = await createExpenseService({ shopId, staffId, authUser, amount, title, category, notes, uploader });

    return res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// GET ALL EXPENSES
export const getExpensesController = async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    console.log(req.user)

    const expenses = await getExpensesService({ shopId, reqUser: req.user });

    return res.status(200).json({ success: true, data: expenses });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


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
    const updateData = req.body.updateData;

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
    res.json(totals);
  } catch (err) {
    next(err);
  }
};
