import mongoose, { Schema, Document } from "mongoose";

enum BusinessType {
  RETAIL = "retail",
  WHOLESALE = "wholesale",
  MANUFACTURER = "manufacturer",
  OTHER = "other"
}

enum KYCStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  REJECTED = "rejected",
}

const kycStatusValues = Object.values(KYCStatus);
const businessTypeValues = Object.values(BusinessType);

interface IShop extends Document {
  shopName: string;
  phoneNumber: string;
  owner: { name: string; passwordHash: string };
  address?: string;
  businessType?: BusinessType;
  otpHash?: string;
  otpExpiresAt?: Date;
  otpAttempts?: number;
  isVerified: boolean;
  kycStatus?: KYCStatus;
  kycSubmittedAt?: Date;
}

const shopSchema = new Schema<IShop>(
  {
    shopName: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true, unique: true },
    owner: {
      name: { type: String, required: true },
      passwordHash: { type: String, required: true, select: false },
    },
    address: {type: String},
    businessType: {type: String, enum: businessTypeValues, default: BusinessType.RETAIL},
    otpHash: { type: String, select: false },
    otpExpiresAt: Date,
    otpAttempts: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    kycStatus: { 
      type: String, 
      enum: kycStatusValues,
      default: KYCStatus.PENDING 
    },
    kycSubmittedAt: Date,
  },
  { timestamps: true }
);

// Index for faster queries
shopSchema.index({ kycStatus: 1 });

export { BusinessType, KYCStatus };
export default mongoose.model<IShop>("Shop", shopSchema);
