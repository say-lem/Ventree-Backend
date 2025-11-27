export class StaffError extends Error {
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

export class ValidationError extends StaffError {
  constructor(message: string, data?: any) {
    super(message, 400, data);
  }
}

export class NotFoundError extends StaffError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class AuthorizationError extends StaffError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class ConflictError extends StaffError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class BusinessRuleError extends StaffError {
  constructor(message: string) {
    super(message, 422);
  }
}