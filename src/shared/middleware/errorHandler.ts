import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../utils/AppError";
import mongoose from "mongoose";

/**
 * Error response interface
 */
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
    [key: string]: any;
  };
  stack?: string;
}

/**
 * Centralized error handling middleware
 * Follows industry standards for error handling
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default error response
  let statusCode = 500;
  let message = "Internal server error";
  let code: string | undefined;
  let isOperational = false;
  let details: any = undefined;

  // Handle known AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    isOperational = err.isOperational;

    // Include validation details if available
    if (err instanceof ValidationError && err.details) {
      details = err.details;
    }

    // Add retry-after header for rate limit errors
    if (statusCode === 429 && "retryAfter" in err) {
      res.setHeader("Retry-After", (err as any).retryAfter || 60);
    }
  }
  // Handle Mongoose validation errors
  else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = "Validation failed";
    code = "VALIDATION_ERROR";
    isOperational = true;
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }
  // Handle Mongoose duplicate key errors
  else if (err instanceof mongoose.Error && (err as any).code === 11000) {
    statusCode = 409;
    message = "Duplicate entry. Resource already exists.";
    code = "DUPLICATE_ERROR";
    isOperational = true;
    const duplicateField = Object.keys((err as any).keyPattern || {})[0];
    if (duplicateField) {
      details = { field: duplicateField };
    }
  }
  // Handle Mongoose cast errors (invalid ObjectId, etc.)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    code = "CAST_ERROR";
    isOperational = true;
  }
  // Handle JWT errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
    code = "INVALID_TOKEN";
    isOperational = true;
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
    code = "TOKEN_EXPIRED";
    isOperational = true;
  }
  // Handle unknown errors
  else {
    // Log unexpected errors in development
    if (process.env.NODE_ENV === "development") {
      console.error("Unexpected error:", err);
    }
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message,
      ...(code && { code }),
      ...(details && { details }),
    },
  };

  // Include stack trace in development mode
  if (process.env.NODE_ENV === "development" && !isOperational) {
    (errorResponse as any).stack = err.stack;
  }

  // Log operational errors (for monitoring)
  // Log all operational errors, not just 500s
  if (isOperational) {
    console.error("Operational error:", {
      message: err.message,
      stack: err.stack,
      statusCode,
      code,
    });
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

