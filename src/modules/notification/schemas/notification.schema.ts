import { Schema, model, Document } from 'mongoose';
import { VectorClock } from '../utils/vector-clock.util';

/**
 * Notification Document Interface
 * Aligns with the entity diagram and architecture document
 */
export interface INotification extends Document {
  shopId: number;
  ownerProfileId?: number;
  staffId?: number;
  inventoryId?: number;
  message: string;
  isRead: boolean;
  vectorClock: VectorClock;
  type: 'low_stock' | 'out_of_stock' | 'sale_completed' | 'inventory_updated' | 'staff_action' | 'staff_created' | 'staff_deleted' | 'expense_added' | 'system' | 'custom';
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    shopId: {
      type: Number,
      required: true,
      index: true,
    },
    ownerProfileId: {
      type: Number,
      index: true,
      sparse: true,
    },
    staffId: {
      type: Number,
      index: true,
      sparse: true,
    },
    inventoryId: {
      type: Number,
      sparse: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    vectorClock: {
      type: Schema.Types.Mixed,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['low_stock', 'out_of_stock', 'sale_completed', 'inventory_updated', 'staff_action', 'staff_created', 'staff_deleted', 'expense_added', 'system', 'custom'],
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true,
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

// Compound indexes for efficient queries (as per architecture document)
NotificationSchema.index({ shopId: 1, created_at: -1 });
NotificationSchema.index({ shopId: 1, staffId: 1, isRead: 1 });
NotificationSchema.index({ shopId: 1, ownerProfileId: 1, isRead: 1 });
NotificationSchema.index({ shopId: 1, type: 1, created_at: -1 });

// Pre-save hook to update updated_at
NotificationSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const NotificationModel = model<INotification>('Notification', NotificationSchema);
