import mongoose, { Schema } from "mongoose";
import { ITicket, ITicketItem } from "../types";

const ticketItemSchema = new Schema<ITicketItem>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
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
      max: [100, "Discount cannot exceed 100%"],
    },
    lineTotal: {
      type: Number,
      required: true,
      min: [0, "Line total cannot be negative"],
    },
    lineProfit: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const ticketSchema = new Schema<ITicket>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    items: {
      type: [ticketItemSchema],
      required: true,
      validate: {
        validator: function (items: ITicketItem[]) {
          return items && items.length > 0;
        },
        message: "Ticket must contain at least one item",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
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
    totalProfit: {
      type: Number,
      required: true,
    },
    totalItemCount: {
      type: Number,
      required: true,
      min: [1, "Total item count must be at least 1"],
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
    customerName: {
      type: String,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
      index: true,
    },
    customerAddress: {
      type: String,
      trim: true,
    },
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
    payments: [
      {
        amount: {
          type: Number,
          required: true,
          min: [0, "Payment amount cannot be negative"],
        },
        paymentMethod: {
          type: String,
          enum: ["cash", "transfer"],
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
      },
    ],
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

// Compound indexes for common queries
ticketSchema.index({ shopId: 1, date: -1 });
ticketSchema.index({ shopId: 1, isCredit: 1, creditStatus: 1 });
ticketSchema.index({ shopId: 1, customerPhone: 1 });
ticketSchema.index({ shopId: 1, soldBy: 1, date: -1 });
ticketSchema.index({ ticketNumber: "text", customerName: "text", notes: "text" });

// Virtual for average item price
ticketSchema.virtual("averageItemPrice").get(function () {
  if (this.totalItemCount === 0) return 0;
  return (this.totalAmount / this.totalItemCount).toFixed(2);
});

// Virtual for profit margin percentage
ticketSchema.virtual("profitMarginPercentage").get(function () {
  if (this.totalAmount === 0) return 0;
  return ((this.totalProfit / this.totalAmount) * 100).toFixed(2);
});

ticketSchema.set("toJSON", { virtuals: true });
ticketSchema.set("toObject", { virtuals: true });

// Pre-save hook to generate ticket number
ticketSchema.pre("save", async function (next) {
  if (this.isNew && !this.ticketNumber) {
    try {
      // Find the ticket with the highest number for this shop
      const lastTicket = await mongoose.model("Ticket")
        .findOne({ shopId: this.shopId })
        .sort({ ticketNumber: -1 })
        .select("ticketNumber");
      
      let sequence = 1;
      if (lastTicket && lastTicket.ticketNumber) {
        // Extract the numeric part from the ticket number (e.g., "0001" -> 1)
        const lastSequence = parseInt(lastTicket.ticketNumber, 10);
        if (!isNaN(lastSequence) && lastSequence > 0) {
          sequence = lastSequence + 1;
        }
      }
      
      // Format as 4-digit number (0001, 0002, etc.)
      // This ensures proper string sorting: "0001" < "0002" < ... < "9999"
      this.ticketNumber = String(sequence).padStart(4, "0");
    } catch (error) {
      // If there's an error, default to 1
      this.ticketNumber = "0001";
    }
  }
  next();
});

const Ticket = mongoose.model<ITicket>("Ticket", ticketSchema);
export default Ticket;