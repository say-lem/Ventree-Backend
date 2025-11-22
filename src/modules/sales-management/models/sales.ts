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
      ref: "Inventory",  // Changed from "Item" to "Inventory"
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
      enum: ["cash", "transfer", "credit"],
      required: true,
      index: true,
    },
    transactionReference: {
      type: String,
      trim: true,
      sparse: true,
    },
    
    // Customer info (required for credit sales)
    customerName: {
      type: String,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerAddress: {
      type: String,
      trim: true,
    },
    
    // Credit sale specific fields
    isCredit: {
      type: Boolean,
      default: false,
      index: true,
    },
    creditStatus: {
      type: String,
      enum: ["pending", "partial", "paid"],
      default: "pending",
      index: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
    },
    amountOwed: {
      type: Number,
      default: 0,
      min: [0, "Amount owed cannot be negative"],
    },
    dueDate: {
      type: Date,
      index: true,
    },
    payments: [{
      amount: {
        type: Number,
        required: true,
        min: [0, "Payment amount cannot be negative"],
      },
      paymentMethod: {
        type: String,
        enum: ["cash", "card", "mobile", "bank_transfer"],
        required: true,
      },
      paymentDate: {
        type: Date,
        default: Date.now,
      },
      receivedBy: {
        type: Schema.Types.ObjectId,
        ref: "Staff",
        required: true,
      },
      receivedByName: {
        type: String,
        required: true,
      },
      transactionReference: {
        type: String,
        trim: true,
      },
      notes: {
        type: String,
        trim: true,
      },
    }],
    
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
    refundedAt: { type: Date },
    refundedBy: { type: Schema.Types.ObjectId, ref: "Staff" },
    refundReason: { type: String, trim: true },
  },
  { timestamps: true }
);

// Indexes
saleSchema.index({ shopId: 1, date: -1 });
saleSchema.index({ shopId: 1, isCredit: 1, creditStatus: 1 });
saleSchema.index({ shopId: 1, customerPhone: 1 });
saleSchema.index({ itemName: "text", customerName: "text", notes: "text" });

// Virtuals
saleSchema.virtual("profitPercentage").get(function () {
  if (this.costPrice === 0) return 0;
  return ((this.profitAmount / (this.costPrice * this.quantitySold)) * 100).toFixed(2);
});

saleSchema.set("toJSON", { virtuals: true });
saleSchema.set("toObject", { virtuals: true });

const Sale = mongoose.model<ISale>("Sale", saleSchema);
export default Sale;