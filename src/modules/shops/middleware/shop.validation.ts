import { Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { ValidationError } from "../../../shared/utils/AppError";
import { BusinessType } from "../../auth/models/shop";

const businessTypeValues = Object.values(BusinessType);

export const validateShopId = [
  param("shopId").isMongoId().withMessage("Invalid shop ID format"),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }
    next();
  },
];

export const validateUpdateShop = [
  body("shopName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Shop name must be between 2 and 100 characters"),
  body("phoneNumber")
    .optional()
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage("Invalid phone number format"),
  body("ownerName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Owner name must be between 2 and 50 characters"),
  body("businessType")
    .optional()
    .isIn(businessTypeValues)
    .withMessage(`Invalid business type. Must be one of: ${businessTypeValues.join(", ")}`),
  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address must not exceed 500 characters"),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }
    next();
  },
];