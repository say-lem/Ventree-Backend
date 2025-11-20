import { Schema, model, Document, Types } from 'mongoose';
import { VectorClock } from '../utils/vector-clock.util';
import { NotificationType } from '../types/notification-types';

/**
 * Notification Document Interface
 * 
 */
export interface INotification extends Document {
  shopId: Types.ObjectId;
  staffId?: Types.ObjectId;
  inventoryId?: Types.ObjectId; 
  message: string;
  isRead: boolean;
  vectorClock: VectorClock;
  type: NotificationType; // Changed: Use enum instead of string literal union
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      index: true,
      sparse: true,
    },
    inventoryId: {
      type: Schema.Types.ObjectId, // ObjectId for production
      ref: 'Inventory',
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
      enum: Object.values(NotificationType), // Changed: Use enum values
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

// Compound indexes for efficient queries
NotificationSchema.index({ shopId: 1, created_at: -1 });
NotificationSchema.index({ shopId: 1, staffId: 1, isRead: 1 });
NotificationSchema.index({ shopId: 1, type: 1, created_at: -1 });
// Index for deduplication queries
NotificationSchema.index({ shopId: 1, inventoryId: 1, type: 1, created_at: -1 });

// Removed: Pre-save hook is redundant with timestamps option

export const NotificationModel = model<INotification>('Notification', NotificationSchema);