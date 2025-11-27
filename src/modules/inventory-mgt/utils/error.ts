export class InventoryError extends Error {
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

export class ValidationError extends InventoryError {
  constructor(message: string, data?: any) {
    super(message, 400, data);
  }
}

export class NotFoundError extends InventoryError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends InventoryError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class InsufficientStockError extends InventoryError {
  constructor(message: string, data?: any) {
    super(message, 422, data);
  }
}

export class AuthorizationError extends InventoryError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class BusinessRuleError extends InventoryError {
  constructor(message: string) {
    super(message, 422);
  }
}