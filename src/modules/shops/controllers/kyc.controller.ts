import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../shared/middleware/auth.middleware";
import crypto from "crypto";
import {
  submitKYCService,
  updateKYCService,
  getKYCStatusService,
} from "../services/kyc.service";

export const submitKYC = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { shopId } = req.params;
    const { address, businessType } = req.body;

    const result = await submitKYCService(
      shopId,
      { address, businessType },
      {
        requestId: crypto.randomUUID(),
        ip: req.ip || req.socket.remoteAddress,
      }
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateKYC = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { shopId } = req.params;
    const { address, businessType } = req.body;

    const result = await updateKYCService(
      shopId,
      { address, businessType },
      {
        requestId: crypto.randomUUID(),
        ip: req.ip || req.socket.remoteAddress,
      }
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getKYCStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { shopId } = req.params;

    const kycStatus = await getKYCStatusService(shopId);

    res.status(200).json({
      success: true,
      data: kycStatus,
    });
  } catch (error) {
    next(error);
  }
};