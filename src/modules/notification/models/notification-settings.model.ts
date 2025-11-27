import { Schema, model, Document, Types } from 'mongoose';

/**
 * Notification Settings Interface
 * Defines per-shop notification preferences for auto-triggered notifications
 */
export interface INotificationSettings extends Document {
  shopId: Types.ObjectId;
  lowStockEnabled: boolean;
  outOfStockEnabled: boolean;
  saleCompletedEnabled: boolean;
  created_at: Date;
  updated_at: Date;
}

const NotificationSettingsSchema = new Schema<INotificationSettings>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      unique: true, // unique: true automatically creates an index
    },
    lowStockEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    outOfStockEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    saleCompletedEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Note: shopId index is automatically created by unique: true constraint
// No need for explicit index definition

export const NotificationSettingsModel = model<INotificationSettings>(
  'NotificationSettings',
  NotificationSettingsSchema
);

