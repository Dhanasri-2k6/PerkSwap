import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDispute extends Document {
  transactionId: mongoose.Types.ObjectId | string;
  initiatorId: mongoose.Types.ObjectId | string;
  reason: string;
  evidenceUrl?: string;
  sellerResponse?: string;
  sellerResponseAt?: Date;
  status: "OPEN" | "RESOLVED_REFUND" | "RESOLVED_RELEASE" | "REJECTED";
  resolutionNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DisputeSchema = new Schema<IDispute>(
  {
    transactionId: { type: Schema.Types.Mixed, required: true, ref: "Transaction", index: true },
    initiatorId: { type: Schema.Types.Mixed, required: true, ref: "User", index: true },
    reason: { type: String, required: true, trim: true },
    evidenceUrl: { type: String },
    sellerResponse: { type: String, trim: true },
    sellerResponseAt: { type: Date },
    status: {
      type: String,
      enum: ["OPEN", "RESOLVED_REFUND", "RESOLVED_RELEASE", "REJECTED"],
      default: "OPEN",
      index: true,
    },
    resolutionNotes: { type: String },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
  },
  { timestamps: true }
);

export const Dispute: Model<IDispute> =
  mongoose.models.Dispute || mongoose.model<IDispute>("Dispute", DisputeSchema);

export default Dispute;
