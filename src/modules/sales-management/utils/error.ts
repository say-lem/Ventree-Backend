export class SalesError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public data?: any;

  constructor(message: string, statusCode: number = 500, data?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.data = data;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends SalesError {
  constructor(message: string, data?: any) {
    super(message, 400, data);
  }
}

export class NotFoundError extends SalesError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class InsufficientStockError extends SalesError {
  constructor(message: string, data?: any) {
    super(message, 422, data);
  }
}

export class RefundError extends SalesError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class AuthorizationError extends SalesError {
  constructor(message: string) {
    super(message, 403);
  }
}