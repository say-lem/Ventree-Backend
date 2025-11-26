import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { ValidationError } from "../../../shared/utils/AppError";
import { request } from "http";
import { getShopProfileService, updateShopProfileService } from "../services/shop.service";


export const getShopProfile = asyncHandler(async(req: Request, res: Response) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        throw new ValidationError("Validation failed", errors.array());
      }

    const { shopId } = req.params;

    const shop = await getShopProfileService(shopId);


    res.status(200).json({
    success: true,
    data: shop,
  });
});

export const updateShopProfile = async (req: Request,res: Response) => {
    const { shopId } = req.params;
    const { shopName, phoneNumber, ownerName, address } = req.body;
    const requestId = crypto.randomUUID();
    const ip = req.ip

    const updatedShop = await updateShopProfileService(shopId, ip, requestId, {
        shopName,
        phoneNumber,
        ownerName,
        address
    });
    
    res.status(200).json({
      success: true,
      data: updatedShop,
    });
};