import mongoose, { Schema, Document } from "mongoose";

interface IStaff extends Document {
  shopId: mongoose.Types.ObjectId;
  staffName: string;
  phoneNumber: string;
  passwordHash: string;
  isActive: boolean;
}

const staffSchema = new Schema<IStaff>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    staffName: { type: String, required: true },
    phoneNumber: { type: String, required: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound unique index: phoneNumber must be unique per shop
staffSchema.index({ shopId: 1, phoneNumber: 1 }, { unique: true });

export default mongoose.model<IStaff>("Staff", staffSchema);
