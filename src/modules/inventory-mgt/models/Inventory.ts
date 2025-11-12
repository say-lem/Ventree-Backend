import mongoose, { Schema, Document } from "mongoose";

export enum Unit {
  KG = "KG",
  GRAM = "GRAM",
  LITER = "LITER",
}

export interface IInventory extends Document {
  shopId: mongoose.Types.ObjectId;
  uploader: string;
  name: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  unit: Unit;
  lowStockAt?: number; 
  createdAt: Date;
  updatedAt: Date;
}

const inventorySchema = new Schema<IInventory>(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    uploader: {
      type: String,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, default: 0 },
    costPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    unit: {
      type: String,
      enum: Object.values(Unit),
      required: true,
    },
    lowStockAt: { type: Number, default: 5 },
  },
  { timestamps: true }
);

export const Inventory = mongoose.model<IInventory>("Inventory", inventorySchema);
