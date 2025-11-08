import { Request, Response } from "express";
import { validationResult } from "express-validator";
import * as AuthService from "../services/auth.service";
import crypto from "crypto";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { ValidationError } from "../../../shared/utils/AppError";

export const registerOwner = asyncHandler(async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  const { shopName, phoneNumber, ownerName, password } = req.body;
  const result = await AuthService.registerOwnerService({
    shopName,
    phoneNumber,
    ownerName,
    password,
    ip: req.ip,
    requestId,
  });

  res.status(201).json({
    success: true,
    data: result,
  });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  const { shopName, phoneNumber, otp } = req.body;
  const result = await AuthService.verifyOtpService({
    shopName,
    phoneNumber,
    otp,
    ip: req.ip,
    requestId,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  const { shopName, phoneNumber, password } = req.body;
  const result = await AuthService.loginUserService({
    shopName,
    phoneNumber,
    password,
    ip: req.ip,
    requestId,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  const { refreshToken } = req.body;
  const result = await AuthService.refreshTokenService({ refreshToken });

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const resendOTP = asyncHandler(async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }

  const { shopName, phoneNumber } = req.body;
  const result = await AuthService.resendOtpService({
    shopName,
    phoneNumber,
    ip: req.ip,
    requestId,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});
