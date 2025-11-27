import { Response } from "express";
import { validationResult } from "express-validator";
import { TicketService } from "../services/sales.service";
import { AuthenticatedRequest } from "../../../shared/middleware/auth.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { ValidationError, AuthenticationError } from "../../../shared/utils/AppError";
import crypto from "crypto";

const ticketService = new TicketService();

/**
 * @route POST /tickets
 * @desc Create a new ticket (multi-item sale)
 */
export const createTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const ticketData = req.body;

  const ticket = await ticketService.createTicket(ticketData, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.shopId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(201).json({
    success: true,
    message: ticket.isCredit ? "Credit ticket created successfully" : "Ticket created successfully",
    data: ticket,
  });
});

/**
 * @route GET /tickets/:shopId
 * @desc Get all tickets (summary view)
 */
export const getTicketList = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
    startDate,
    endDate,
    soldBy,
    paymentMethod,
    includeRefunded = "false",
    isCredit,
    creditStatus,
    page = "1",
    limit = "20",
    sortBy = "date",
    sortOrder = "desc",
  } = req.query;

  const result = await ticketService.getTicketList(
    shopId,
    {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      soldBy: soldBy as string,
      paymentMethod: paymentMethod as string,
      includeRefunded: includeRefunded === "true",
      isCredit: isCredit ? isCredit === "true" : undefined,
      creditStatus: creditStatus as "pending" | "partial" | "paid" | undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc",
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
    message: "Tickets retrieved successfully",
    data: result,
  });
});

/**
 * @route GET /tickets/:shopId/items
 * @desc Get all items sold (individual item view from all tickets)
 */
export const getAllItemsSold = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
    startDate,
    endDate,
    soldBy,
    paymentMethod,
    includeRefunded = "false",
    page = "1",
    limit = "20",
    sortBy = "date",
    sortOrder = "desc",
  } = req.query;

  const result = await ticketService.getAllItemsSold(
    shopId,
    {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      soldBy: soldBy as string,
      paymentMethod: paymentMethod as string,
      includeRefunded: includeRefunded === "true",
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc",
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
    message: "Items sold retrieved successfully",
    data: result,
  });
});

/**
 * @route GET /tickets/:shopId/:ticketId
 * @desc Get single ticket by ID (with all items)
 */
export const getTicketById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, ticketId } = req.params;

  const ticket = await ticketService.getTicketById(ticketId, shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Ticket retrieved successfully",
    data: ticket,
  });
});

/**
 * @route PUT /tickets/:shopId/:ticketId
 * @desc Update ticket details
 */
export const updateTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, ticketId } = req.params;
  const updates = req.body;

  const ticket = await ticketService.updateTicket(ticketId, shopId, updates, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Ticket updated successfully",
    data: ticket,
  });
});

/**
 * @route POST /tickets/:shopId/:ticketId/refund
 * @desc Refund a ticket
 */
export const refundTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, ticketId } = req.params;
  const { reason, refundedBy } = req.body;

  const ticket = await ticketService.refundTicket(
    ticketId,
    shopId,
    { reason, refundedBy },
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
    message: "Ticket refunded successfully",
    data: ticket,
  });
});

/**
 * @route DELETE /tickets/:shopId/:ticketId
 * @desc Delete a ticket (owner only)
 */
export const deleteTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, ticketId } = req.params;

  await ticketService.deleteTicket(ticketId, shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Ticket deleted successfully",
  });
});

/**
 * @route GET /tickets/:shopId/analytics
 * @desc Get sales analytics
 */
export const getAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;
  const { startDate, endDate, includeRefunded = "false" } = req.query;

  const analytics = await ticketService.getAnalytics(
    shopId,
    {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      includeRefunded: includeRefunded === "true",
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
    message: "Analytics retrieved successfully",
    data: analytics,
  });
});

/**
 * @route GET /tickets/:shopId/search
 * @desc Search tickets
 */
export const searchTickets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;
  const { q, page = "1", limit = "20" } = req.query;

  const result = await ticketService.searchTickets(
    shopId,
    q as string,
    parseInt(page as string),
    parseInt(limit as string),
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
    message: "Search results retrieved successfully",
    data: result,
  });
});

/**
 * @route POST /tickets/:shopId/:ticketId/payment
 * @desc Record a payment for a credit ticket
 */
export const recordCreditPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, ticketId } = req.params;
  const { amount, paymentMethod, receivedBy, transactionReference, notes } = req.body;

  const ticket = await ticketService.recordCreditPayment(
    {
      ticketId,
      shopId,
      amount,
      paymentMethod,
      receivedBy,
      transactionReference,
      notes,
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
    message: ticket.creditStatus === "paid" 
      ? "Payment recorded. Credit ticket fully paid!" 
      : "Payment recorded successfully",
    data: ticket,
  });
});

/**
 * @route GET /tickets/:shopId/credit
 * @desc Get all credit tickets
 */
export const getCreditTickets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
    creditStatus,
    customerPhone,
    startDate,
    endDate,
    page = "1",
    limit = "20",
    sortBy = "date",
    sortOrder = "desc",
  } = req.query;

  const result = await ticketService.getCreditTickets(
    shopId,
    {
      creditStatus: creditStatus as "pending" | "partial" | "paid" | undefined,
      customerPhone: customerPhone as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc",
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
    message: "Credit tickets retrieved successfully",
    data: result,
  });
});

/**
 * @route GET /tickets/:shopId/credit/summary
 * @desc Get credit sales summary
 */
export const getCreditSalesSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;

  const summary = await ticketService.getCreditSalesSummary(shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Credit sales summary retrieved successfully",
    data: summary,
  });
});

/**
 * @route GET /tickets/:shopId/credit/overdue
 * @desc Get overdue credit tickets
 */
export const getOverdueCreditTickets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;

  const overdueTickets = await ticketService.getOverdueCreditTickets(shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Overdue credit tickets retrieved successfully",
    data: {
      tickets: overdueTickets,
      count: overdueTickets.length,
    },
  });
});

/**
 * @route GET /tickets/:shopId/credit/customer/:customerPhone
 * @desc Get credit history for a specific customer
 */
export const getCustomerCreditHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, customerPhone } = req.params;

  const result = await ticketService.getCustomerCreditHistory(
    shopId,
    customerPhone,
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
    message: "Customer credit history retrieved successfully",
    data: result,
  });
});