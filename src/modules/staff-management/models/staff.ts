import { Schema, model } from "mongoose";
import { IStaff } from "../types";

const staffSchema = new Schema<IStaff>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    staffName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["cashier", "manager", "inventory", "staff"],
      default: "staff",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockoutUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for better query performance
staffSchema.index({ shopId: 1, phoneNumber: 1 }, { unique: true });
staffSchema.index({ shopId: 1, isActive: 1 });
staffSchema.index({ shopId: 1, role: 1 });

// Prevent password from being returned in JSON
staffSchema.set("toJSON", {
  transform: function (doc, ret) {
    const transformed = ret as any;
    delete transformed.passwordHash;
    delete transformed.failedLoginAttempts;
    delete transformed.lockoutUntil;
    return transformed;
  },
});

const Staff = model<IStaff>("Staff", staffSchema);

export default Staff;