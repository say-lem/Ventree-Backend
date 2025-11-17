import mongoose, { Schema } from "mongoose";
import { IInventoryItem } from "../types";

const inventorySchema = new Schema<IInventoryItem>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true,
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
    minSellingPrice: {
      type: Number,
      min: [0, "Minimum selling price cannot be negative"],
    },
    initialQuantity: {
      type: Number,
      required: true,
      min: [0, "Initial quantity cannot be negative"],
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: [0, "Available quantity cannot be negative"],
      index: true,
    },
    soldQuantity: {
      type: Number,
      default: 0,
      min: [0, "Sold quantity cannot be negative"],
    },
    damagedQuantity: {
      type: Number,
      default: 0,
      min: [0, "Damaged quantity cannot be negative"],
    },
    returnedQuantity: {
      type: Number,
      default: 0,
      min: [0, "Returned quantity cannot be negative"],
    },
    reorderLevel: {
      type: Number,
      default: 10,
      min: [0, "Reorder level cannot be negative"],
    },
    reorderQuantity: {
      type: Number,
      default: 50,
      min: [0, "Reorder quantity cannot be negative"],
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    supplier: {
      name: {
        type: String,
        trim: true,
      },
      contact: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
    },
    expiryDate: {
      type: Date,
      index: true,
    },
    manufacturingDate: {
      type: Date,
    },
    location: {
      type: String,
      trim: true,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isLowStock: {
      type: Boolean,
      default: false,
      index: true,
    },
    isOutOfStock: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastRestocked: {
      type: Date,
    },
    lastSold: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Staff",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for better performance
inventorySchema.index({ shopId: 1, sku: 1 }, { unique: true });
inventorySchema.index({ shopId: 1, barcode: 1 }, { sparse: true });
inventorySchema.index({ shopId: 1, category: 1 });
inventorySchema.index({ shopId: 1, isActive: 1 });
inventorySchema.index({ shopId: 1, isLowStock: 1 });
inventorySchema.index({ shopId: 1, isOutOfStock: 1 });
inventorySchema.index({ shopId: 1, availableQuantity: 1 });
inventorySchema.index({ shopId: 1, expiryDate: 1 });
inventorySchema.index({ shopId: 1, name: 1 });

// Text index for search
inventorySchema.index({
  name: "text",
  description: "text",
  category: "text",
  tags: "text",
});

// Virtual for profit margin
inventorySchema.virtual("profitMargin").get(function () {
  if (this.costPrice === 0) return 0;
  return (((this.sellingPrice - this.costPrice) / this.costPrice) * 100).toFixed(2);
});

// Virtual for profit amount
inventorySchema.virtual("profitAmount").get(function () {
  return this.sellingPrice - this.costPrice;
});

// Virtual for total value in stock
inventorySchema.virtual("totalValue").get(function () {
  return this.availableQuantity * this.costPrice;
});

// Virtual for total retail value
inventorySchema.virtual("totalRetailValue").get(function () {
  return this.availableQuantity * this.sellingPrice;
});

// Virtual for days until expiry
inventorySchema.virtual("daysUntilExpiry").get(function () {
  if (!this.expiryDate) return null;
  const today = new Date();
  const expiry = new Date(this.expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for stock turnover (sold / initial)
inventorySchema.virtual("stockTurnover").get(function () {
  if (this.initialQuantity === 0) return 0;
  return ((this.soldQuantity / this.initialQuantity) * 100).toFixed(2);
});

// Pre-save middleware to update stock status
inventorySchema.pre("save", function (next) {
  // Update low stock status
  this.isLowStock = this.availableQuantity <= this.reorderLevel && this.availableQuantity > 0;

  // Update out of stock status
  this.isOutOfStock = this.availableQuantity === 0;

  next();
});

// Pre-update middleware
inventorySchema.pre("findOneAndUpdate", function (next) {
  const update: any = this.getUpdate();

  if (update.$set && update.$set.availableQuantity !== undefined) {
    const quantity = update.$set.availableQuantity;
    const reorderLevel = update.$set.reorderLevel || 10;

    update.$set.isLowStock = quantity <= reorderLevel && quantity > 0;
    update.$set.isOutOfStock = quantity === 0;
  }

  next();
});

// Ensure virtuals are included in JSON
inventorySchema.set("toJSON", { virtuals: true });
inventorySchema.set("toObject", { virtuals: true });

const Inventory = mongoose.model<IInventoryItem>("Inventory", inventorySchema);

export default Inventory;