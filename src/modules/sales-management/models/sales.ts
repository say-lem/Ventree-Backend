import mongoose, { Schema } from "mongoose";
import { ISale } from "../types";

const saleSchema = new Schema<ISale>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "Item",
      required: true,
      index: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    itemCategory: {
      type: String,
      trim: true,
    },
    quantitySold: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    costPrice: {
      type: Number,
      required: true,
      min: [0, "Cost price cannot be negative"],
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: [0, "Selling price cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, "Tax amount cannot be negative"],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, "Total amount cannot be negative"],
    },
    profitAmount: {
      type: Number,
      required: true,
    },
    soldBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },
    soldByName: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "mobile", "bank_transfer"],
      required: true,
      index: true,
    },
    transactionReference: {
      type: String,
      trim: true,
      sparse: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    refunded: {
      type: Boolean,
      default: false,
      index: true,
    },
    refundedAt: {
      type: Date,
    },
    refundedBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
    },
    refundReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for better query performance
saleSchema.index({ shopId: 1, date: -1 });
saleSchema.index({ shopId: 1, itemId: 1 });
saleSchema.index({ shopId: 1, soldBy: 1 });
saleSchema.index({ shopId: 1, paymentMethod: 1 });
saleSchema.index({ shopId: 1, refunded: 1 });
saleSchema.index({ shopId: 1, date: -1, refunded: 1 });

// Text index for searching
saleSchema.index({ itemName: "text", customerName: "text", notes: "text" });

// Virtual for profit percentage
saleSchema.virtual("profitPercentage").get(function () {
  if (this.costPrice === 0) return 0;
  return ((this.profitAmount / (this.costPrice * this.quantitySold)) * 100).toFixed(2);
});

// Ensure virtuals are included in JSON
saleSchema.set("toJSON", { virtuals: true });
saleSchema.set("toObject", { virtuals: true });

const Sale = mongoose.model<ISale>("Sale", saleSchema);

export default Sale;