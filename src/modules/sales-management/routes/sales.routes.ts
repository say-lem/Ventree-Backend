import express from "express";
import {
  createTicket,
  getTicketList,
  getAllItemsSold,
  getTicketById,
  updateTicket,
  refundTicket,
  deleteTicket,
  getAnalytics,
  searchTickets,
  recordCreditPayment,
  getCreditTickets,
  getCreditSalesSummary,
  getOverdueCreditTickets,
  getCustomerCreditHistory,
} from "../controllers/sales.controller";
import {
  createTicketValidation,
  updateTicketValidation,
  refundTicketValidation,
  shopIdValidation,
  ticketIdValidation,
  getTicketsValidation,
  analyticsValidation,
  searchTicketsValidation,
  recordCreditPaymentValidation,
  getCreditTicketsValidation,
  customerPhoneValidation,
} from "../validators/sale.validator";
import {
  authenticate,
  ownerOnly,
  verifyShopAccess,
  requireRole,
} from "../../../shared/middleware/auth.middleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);


// Create new ticket (multi-item sale)
router.post("/", createTicketValidation, createTicket);

// Get tickets list (summary view)
router.get(
  "/:shopId",
  getTicketsValidation,
  verifyShopAccess,
  getTicketList
);

// Get all items sold (individual item view from all tickets)
router.get(
  "/:shopId/items",
  getTicketsValidation,
  verifyShopAccess,
  getAllItemsSold
);

// Get analytics
router.get(
  "/:shopId/analytics",
  analyticsValidation,
  verifyShopAccess,
  requireRole("owner", "staff"),
  getAnalytics
);

// Search tickets
router.get(
  "/:shopId/search",
  searchTicketsValidation,
  verifyShopAccess,
  searchTickets
);

// Get all credit tickets
router.get(
  "/:shopId/credit",
  getCreditTicketsValidation,
  verifyShopAccess,
  getCreditTickets
);

// Credit sales summary
router.get(
  "/:shopId/credit/summary",
  shopIdValidation,
  verifyShopAccess,
  getCreditSalesSummary
);

// Overdue credit tickets
router.get(
  "/:shopId/credit/overdue",
  shopIdValidation,
  verifyShopAccess,
  getOverdueCreditTickets
);

// Customer credit history
router.get(
  "/:shopId/credit/customer/:customerPhone",
  customerPhoneValidation,
  verifyShopAccess,
  getCustomerCreditHistory
);

// Get single ticket by ID (with all items)
router.get(
  "/:shopId/:ticketId",
  shopIdValidation,
  ticketIdValidation,
  verifyShopAccess,
  getTicketById
);

// Update ticket (owner only)
router.put(
  "/:shopId/:ticketId",
  updateTicketValidation,
  verifyShopAccess,
  ownerOnly,
  updateTicket
);

// Refund ticket (owner only)
router.post(
  "/:shopId/:ticketId/refund",
  refundTicketValidation,
  verifyShopAccess,
  ownerOnly,
  refundTicket
);

// Record credit payment
router.post(
  "/:shopId/:ticketId/payment",
  recordCreditPaymentValidation,
  verifyShopAccess,
  recordCreditPayment
);

// Delete ticket (owner only)
router.delete(
  "/:shopId/:ticketId",
  shopIdValidation,
  ticketIdValidation,
  verifyShopAccess,
  ownerOnly,
  deleteTicket
);

export default router;