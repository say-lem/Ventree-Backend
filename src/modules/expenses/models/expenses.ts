import mongoose, { Schema, Document } from "mongoose";

interface IExpense extends Document {
    _id: mongoose.Types.ObjectId;
    shopId: mongoose.Types.ObjectId;
    title: string;
    category: string;
    amount: number;
    notes?: string;
    uploader: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}


const expenseSchema = new Schema<IExpense>(
    {
        shopId: {
            type: Schema.Types.ObjectId,
            ref: "Shop",
            required: [true, "Shop ID is required"],
            index: true
        },
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
            minlength: [3, "Title must be at least 3 characters"],
            maxlength: [200, "Title cannot exceed 200 characters"]
        },
        category: {
            type: String,
            required: [true, "category is required"],
            trim: true,
            minlength: [3, "category must be at least 3 characters"],
            maxlength: [200, "category cannot exceed 200 characters"]
        },
        amount: {
            type: Number,
            required: true,
            min: [0.01, "Expense amount must be greater than 0"] 
        },
        notes: {
            type: String,
            trim: true,
            maxlength: [1000, "Notes cannot exceed 1000 characters"],
        },
        uploader: {
            type: Schema.Types.ObjectId,
            ref: 'Staff',
            required: [true, "Uploader is required"],
            index: true
        }
    },
    {
        timestamps: true,
    }
)

expenseSchema.index({ shopId: 1, createdAt: -1 });

export default mongoose.model<IExpense>("Expense", expenseSchema);