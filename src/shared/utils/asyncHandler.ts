import { Request, Response, NextFunction } from "express";

/**
 * Async handler wrapper to catch errors in async route handlers
 * Prevents unhandled promise rejections in Express routes
 * 
 * @param fn - Async function to wrap
 * @returns Wrapped function that catches errors and passes them to error middleware
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

