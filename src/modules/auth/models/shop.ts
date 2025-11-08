import mongoose, { Schema, Document } from "mongoose";

interface IShop extends Document {
  shopName: string;
  phoneNumber: string;
  owner: { name: string; passwordHash: string };
  otpHash?: string;
  otpExpiresAt?: Date;
  otpAttempts?: number;
  isVerified: boolean;
}

const shopSchema = new Schema<IShop>(
  {
    shopName: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true, unique: true },
    owner: {
      name: { type: String, required: true },
      passwordHash: { type: String, required: true, select: false },
    },
    otpHash: { type: String, select: false },
    otpExpiresAt: Date,
    otpAttempts: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IShop>("Shop", shopSchema);
