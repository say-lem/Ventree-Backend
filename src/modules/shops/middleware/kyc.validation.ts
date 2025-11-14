import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { ValidationError } from "../../../shared/utils/AppError";
import { BusinessType } from "../../auth/models/shop";

const businessTypeValues = Object.values(BusinessType);

export const validateSubmitKYC = [
  body("address")
    .notEmpty()
    .withMessage("Address is required")
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Address must be between 10 and 500 characters"),
  body("businessType")
    .notEmpty()
    .withMessage("Business type is required")
    .isIn(businessTypeValues)
    .withMessage(`Invalid business type. Must be one of: ${businessTypeValues.join(", ")}`),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }
    next();
  },
];

export const validateUpdateKYC = [
  body("address")
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Address must be between 10 and 500 characters"),
  body("businessType")
    .optional()
    .isIn(businessTypeValues)
    .withMessage(`Invalid business type. Must be one of: ${businessTypeValues.join(", ")}`),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }
    next();
  },
];