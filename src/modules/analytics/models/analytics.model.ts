import mongoose, { Schema, Document } from "mongoose";

export interface IAnalyticsSnapshot extends Document {
  shopId: mongoose.Types.ObjectId;
  type: string;
  periodStart?: Date;
  periodEnd?: Date;
  payload: any;
  createdAt: Date;
  updatedAt: Date;
}

const analyticsSnapshotSchema = new Schema<IAnalyticsSnapshot>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
    },
    periodStart: {
      type: Date,
    },
    periodEnd: {
      type: Date,
    },
    payload: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

analyticsSnapshotSchema.index({ shopId: 1, type: 1, periodStart: -1 });

const AnalyticsSnapshotModel = mongoose.model<IAnalyticsSnapshot>("AnalyticsSnapshot", analyticsSnapshotSchema);

export default AnalyticsSnapshotModel;
