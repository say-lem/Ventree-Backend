import mongoose, { Schema } from "mongoose";
import { StockMovement } from "../types";

const stockMovementSchema = new Schema<StockMovement>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },
    itemName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["sale", "restock", "adjustment", "damage", "return"],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    beforeQuantity: {
      type: Number,
      required: true,
    },
    afterQuantity: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Staff",
    },
    performedByName: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
stockMovementSchema.index({ itemId: 1, date: -1 });
stockMovementSchema.index({ itemId: 1, type: 1 });

const StockMovementModel = mongoose.model<StockMovement>(
  "StockMovement",
  stockMovementSchema
);

export default StockMovementModel;