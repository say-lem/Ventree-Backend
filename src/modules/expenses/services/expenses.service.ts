// src/modules/expenses/services/expense.services.ts
import Expense from "../models/expenses";
import Shop from "../../auth/models/shop";
import Staff from "../../staff-management/models/staff";
import { ValidationError } from "../../../shared/utils/AppError";
import { checkRateLimit, getShopUpdateAttemptsStore, resetRateLimit } from "../../auth/utils/rateLimit";
import { toString } from "express-validator/lib/utils";

/**
 * Rate limit settings for expense operations
 * Adjust these values if you want a different policy
 */
const EXPENSE_CREATE_MAX_ATTEMPTS = 30;
const EXPENSE_UPDATE_MAX_ATTEMPTS = 30;
const EXPENSE_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// CREATE EXPENSE ─ owner, manager only
export const createExpenseService = async ({ shopId, staffId, authUser, amount, title, category, notes, uploader }) => {
  // authUser = decoded user from authenticate middleware
  // authUser.role will be "owner" or "staff"

  // rate-limit check
  const createKey = `shop:expense:create:${shopId}`;
  const rlCreate = checkRateLimit(
    createKey,
    getShopUpdateAttemptsStore(),
    EXPENSE_CREATE_MAX_ATTEMPTS,
    EXPENSE_LOCKOUT_DURATION_MS
  );

  if (!rlCreate.allowed) {
    throw new ValidationError(`Too many create requests. Try again later.`);
  }

  // 1. Ensure the shop exists
  const shop = await Shop.findById(shopId);
  if (!shop) {
    throw new ValidationError("Invalid shop id, shop does not exist");
  }

  // ─────────────────────────────────────────────
  // CASE A: OWNER (has no staffId)
  // ─────────────────────────────────────────────
  if (authUser.role === "owner") {
    if (authUser.shopId.toString() !== shop.id.toString()) {
      throw new ValidationError("Unauthorized, you are not the shop owner");
    }

    // owner creates expense without staffId
    const expense = await Expense.create({
      shopId,
      uploader, 
      amount,
      title,
      category,
      notes,
      createdByRole: "owner"
    });

    return expense;
  }

  // ─────────────────────────────────────────────
  // CASE B: STAFF (must be manager)
  // ─────────────────────────────────────────────
  const staff = await Staff.findOne({ _id: staffId, shop: shopId });
  if (!staff) {
    throw new ValidationError("Unauthorized. Staff does not belong to this shop");
  }

  if (staff.role !== "manager") {
    throw new ValidationError("Only managers can create an expense");
  }

  // Manager creates expense
  const expense = await Expense.create({
    shopId,
    uploader: staffId,
    amount,
    title,
    category,
    notes,
    createdByRole: "manager"
  });

  return expense;
};



export const getExpensesService = async ({ shopId, staffId, reqUser }) => {
  // 1. Shop exists?
  const shop = await Shop.findById(shopId);
  if (!shop) throw new ValidationError("Invalid shop id, shop does not exist");

  // 2. Role logic
  if (reqUser.role === "owner") {
    // ✔ Owner: skip staff check
    return Expense.find({ shopId }).sort({ createdAt: -1 });
  }

  // 3. Staff logic: Must belong to shop
  const staff = await Staff.findOne({ _id: staffId, shop: shopId });
  if (!staff) throw new ValidationError("Unauthorized. Staff does not belong to this shop");

  return Expense.find({ shopId }).sort({ createdAt: -1 });
};



// FILTERED EXPENSES + TOTAL (today | week | month) ─ any staff or owner
// returns { expenses, total }
export const getFilteredExpensesService = async ({ shopId, staffId, filter }) => {
  // check shop exists
  const shop = await Shop.findById(shopId);
  if (!shop) throw new ValidationError("Invalid shop id, shop does not exist");

  // ensure staff belongs to shop
  const staff = await Staff.findOne({ _id: staffId, shop: shopId });
  if (!staff) throw new ValidationError("Unauthorized. Staff does not belong to this shop");

  const now = new Date();
  let startDate: Date | null = null;

  if (filter === "today") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (filter === "week") {
    const diff = now.getDate() - now.getDay();
    startDate = new Date(now.getFullYear(), now.getMonth(), diff);
  } else if (filter === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    throw new ValidationError("Invalid filter. Use 'today', 'week' or 'month'");
  }

  const query: any = { shopId };
  if (startDate) query.createdAt = { $gte: startDate };

  const expenses = await Expense.find(query).sort({ createdAt: -1 });
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return { expenses, total };
};


// GET SINGLE EXPENSE ─ any staff or owner of the shop
export const getSingleExpenseService = async ({ shopId, staffId, expenseId, reqUser }) => {
  // 1. Validate shop
  const shop = await Shop.findById(shopId);
  if (!shop) throw new ValidationError("Invalid shop id, shop does not exist");

  // 2. Owner bypasses staff check
  if (reqUser.role !== "owner") {
    // Staff must belong to the shop
    const staff = await Staff.findOne({ _id: staffId, shop: shopId });
    if (!staff) throw new ValidationError("Unauthorized. Staff does not belong to this shop");
  }

  // 3. Fetch the expense
  const expense = await Expense.findOne({ _id: expenseId, shopId });
  if (!expense) throw new ValidationError("Expense not found for this shop");

  return expense;
};


// UPDATE EXPENSE ─ manager OR owner
export const updateExpenseService = async ({
  shopId,
  staffId,
  expenseId,
  updateData,
  reqUser
}) => {
  // 1. Rate-limit
  const updateKey = `shop:expense:update:${shopId}`;
  const rlUpdate = checkRateLimit(
    updateKey,
    getShopUpdateAttemptsStore(),
    EXPENSE_UPDATE_MAX_ATTEMPTS,
    EXPENSE_LOCKOUT_DURATION_MS
  );
  if (!rlUpdate.allowed) {
    throw new ValidationError("Too many update requests. Try again later.");
  }

  // 2. Check shop exists
  const shop = await Shop.findById(shopId);
  if (!shop) throw new ValidationError("Invalid shop id, shop does not exist");

  // 3. Permission check
  if (reqUser.role === "owner") {
    // owner is allowed, skip staff lookup
  } else {
    // user is a staff → must belong to shop
    const staff = await Staff.findOne({ _id: staffId, shop: shopId });
    if (!staff) {
      throw new ValidationError("Unauthorized. Staff does not belong to this shop");
    }

    // staff must be manager
    if (staff.role !== "manager") {
      throw new ValidationError("Only managers or shop owner can update an expense");
    }
  }
  
  // 4. Update expense
  const expense = await Expense.findOne({
    _id: expenseId,
    shopId: shopId,
    });

    if (!expense) {
    throw new ValidationError("Expense not found");
    }

  Object.assign(expense, updateData);
  await expense.save();


  return expense;
};


// DELETE EXPENSE ─ owner only
export const deleteExpenseService = async ({ shopId, expenseId, reqUser }) => {
  // 1. Ensure shop exists
  const shop = await Shop.findById(shopId);
  if (!shop) throw new ValidationError("Invalid shop id, shop does not exist");

  // 2. Optionally: verify requester is shop.ownerId (if you store owner in shop)
  if (reqUser.shopId !== toString(shop._id)) throw new ValidationError("Only the shop owner can delete an expense");

  console.log(expenseId, shopId)
  // 3. Delete expense
  const expense = await Expense.findOneAndDelete({ _id: expenseId, shopId });
  if (!expense) throw new ValidationError("Expense not found");

  return { message: "Expense deleted successfully" };
};


// TOTAL EXPENSES (today | week | month | total) ─ any staff or owner
// returns { today, week, month, total }
export const getTotalExpensesService = async ({ shopId, staffId, reqUser }) => {
  // 1. Validate shop
  const shop = await Shop.findById(shopId);
  if (!shop) throw new ValidationError("Invalid shop id, shop does not exist");

  // 2. If user is NOT owner, they must be a staff of this shop
  if (reqUser.role !== "owner") {
    const staff = await Staff.findOne({ _id: staffId, shop: shopId });
    if (!staff) throw new ValidationError("Unauthorized. Staff does not belong to this shop");
  }

  // 3. Fetch all expenses for the shop
  const all = await Expense.find({ shopId });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = { today: 0, week: 0, month: 0, total: 0 };

  for (const exp of all) {
    const t = exp.createdAt;
    const amt = exp.amount || 0;

    result.total += amt;
    if (t >= todayStart) result.today += amt;
    if (t >= weekStart) result.week += amt;
    if (t >= monthStart) result.month += amt;
  }

  return result;
};
