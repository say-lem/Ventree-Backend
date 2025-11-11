import Shop from "../../auth/models/shop";
import { Types } from "mongoose";

export class ShopRepository {
  
 //Check if shop exists
  async exists(shopId: string): Promise<boolean> {
    const shop = await Shop.findById(shopId).lean();
    return !!shop;
  }

   // Check if shop exists and is verified
  async existsAndVerified(shopId: string): Promise<boolean> {
    const shop = await Shop.findOne({
      _id: new Types.ObjectId(shopId),
      isVerified: true,
    }).lean();
    return !!shop;
  }

   // Find shop by ID
  async findById(shopId: string) {
    return await Shop.findById(shopId);
  }
}