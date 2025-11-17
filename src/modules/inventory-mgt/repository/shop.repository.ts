import Shop from "../../auth/models/shop";
import { Types } from "mongoose";

export class ShopRepository {
  async existsAndVerified(shopId: string): Promise<boolean> {
    const shop = await Shop.findOne({
      _id: new Types.ObjectId(shopId),
      isVerified: true,
    }).lean();
    return !!shop;
  }

  async findById(shopId: string) {
    return await Shop.findById(shopId);
  }
}