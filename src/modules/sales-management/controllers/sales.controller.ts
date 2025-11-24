import { Response } from "express";
import { validationResult } from "express-validator";
import { SalesService } from "../services/sales.service";
import { AuthenticatedRequest } from "../../../shared/middleware/auth.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { ValidationError, AuthenticationError } from "../../../shared/utils/AppError";
import crypto from "crypto";

const salesService = new SalesService();

/**
 * @route POST /sales
 * @desc Record a new sale (including credit sales)
 */
export const recordSale = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const saleData = req.body;

  const sale = await salesService.recordSale(saleData, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.shopId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(201).json({
    success: true,
    message: sale.isCredit ? "Credit sale recorded successfully" : "Sale recorded successfully",
    data: sale,
  });
});

/**
 * @route GET /sales/:shopId
 * @desc Get all sales for a shop with filters
 */
export const getSalesList = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
    itemId,
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

  const result = await salesService.getSalesList(
    shopId,
    {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      itemId: itemId as string,
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
    message: "Sales retrieved successfully",
    data: result,
  });
});

/**
 * @route GET /sales/:shopId/:saleId
 * @desc Get single sale by ID
 */
export const getSaleById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, saleId } = req.params;

  const sale = await salesService.getSaleById(saleId, shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Sale retrieved successfully",
    data: sale,
  });
});

/**
 * @route PUT /sales/:shopId/:saleId
 * @desc Update sale details
 */
export const updateSale = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, saleId } = req.params;
  const updates = req.body;

  const sale = await salesService.updateSale(saleId, shopId, updates, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Sale updated successfully",
    data: sale,
  });
});

/**
 * @route POST /sales/:shopId/:saleId/refund
 * @desc Refund a sale
 */
export const refundSale = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, saleId } = req.params;
  const { reason, refundedBy } = req.body;

  const sale = await salesService.refundSale(
    saleId,
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
    message: "Sale refunded successfully",
    data: sale,
  });
});

/**
 * @route DELETE /sales/:shopId/:saleId
 * @desc Delete a sale (owner only)
 */
export const deleteSale = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId, saleId } = req.params;

  await salesService.deleteSale(saleId, shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Sale deleted successfully",
  });
});

/**
 * @route GET /sales/:shopId/analytics
 * @desc Get sales analytics
 */
export const getSalesAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

  const analytics = await salesService.getSalesAnalytics(
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
    message: "Sales analytics retrieved successfully",
    data: analytics,
  });
});

/**
 * @route GET /sales/:shopId/search
 * @desc Search sales
 */
export const searchSales = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

  const result = await salesService.searchSales(
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
 * @route GET /sales/:shopId/report
 * @desc Generate sales report
 */
export const generateSalesReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ValidationError("Start date and end date are required for reports");
  }

  const report = await salesService.getSalesReport(
    shopId,
    new Date(startDate as string),
    new Date(endDate as string),
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
    message: "Sales report generated successfully",
    data: report,
  });
});

/**
 * @route GET /sales/:shopId/top-items
 * @desc Get top performing items
 */
export const getTopPerformingItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;
  const { limit = "10", startDate, endDate } = req.query;

  const topItems = await salesService.getTopPerformingItems(
    shopId,
    parseInt(limit as string),
    startDate ? new Date(startDate as string) : undefined,
    endDate ? new Date(endDate as string) : undefined,
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
    message: "Top performing items retrieved successfully",
    data: topItems,
  });
});

/**
 * @route GET /sales/:shopId/staff-performance
 * @desc Get staff performance
 */
export const getStaffPerformance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;
  const { startDate, endDate } = req.query;

  const performance = await salesService.getStaffPerformance(
    shopId,
    startDate ? new Date(startDate as string) : undefined,
    endDate ? new Date(endDate as string) : undefined,
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
    message: "Staff performance retrieved successfully",
    data: performance,
  });
});

/**
 * @route POST /sales/:shopId/:saleId/payment
 * @desc Record a payment for a credit sale
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
  const { shopId, saleId } = req.params;
  const { amount, paymentMethod, receivedBy, transactionReference, notes } = req.body;

  const sale = await salesService.recordCreditPayment(
    {
      saleId,
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
    message: sale.creditStatus === "paid" 
      ? "Payment recorded. Credit sale fully paid!" 
      : "Payment recorded successfully",
    data: sale,
  });
});

/**
 * @route GET /sales/:shopId/credit
 * @desc Get all credit sales for a shop
 */
export const getCreditSales = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

  const result = await salesService.getCreditSales(
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
    message: "Credit sales retrieved successfully",
    data: result,
  });
});

/**
 * @route GET /sales/:shopId/credit/summary
 * @desc Get credit sales summary for a shop
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

  const summary = await salesService.getCreditSalesSummary(shopId, {
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
 * @route GET /sales/:shopId/credit/overdue
 * @desc Get overdue credit sales for a shop
 */
export const getOverdueCreditSales = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  if (!req.user) {
    throw new AuthenticationError("User not authenticated");
  }

  const requestId = crypto.randomUUID();
  const { shopId } = req.params;

  const overdueSales = await salesService.getOverdueCreditSales(shopId, {
    requestId,
    ip: req.ip || "unknown",
    userId: req.user.profileId,
    userRole: req.user.role,
    userShopId: req.user.shopId,
  });

  res.status(200).json({
    success: true,
    message: "Overdue credit sales retrieved successfully",
    data: {
      sales: overdueSales,
      count: overdueSales.length,
    },
  });
});

/**
 * @route GET /sales/:shopId/credit/customer/:customerPhone
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

  const result = await salesService.getCustomerCreditHistory(
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