import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISwap extends Document {
  requesterId: mongoose.Types.ObjectId | string;
  requestedId: mongoose.Types.ObjectId | string;
  offeredVoucherId: mongoose.Types.ObjectId | string;
  targetVoucherId: mongoose.Types.ObjectId | string;
  status:
    | "PENDING"
    | "ACCEPTED"
    | "DECLINED"
    | "REJECTED"
    | "CANCELLED"
    | "CONFIRMATION_PENDING"
    | "COMPLETED"
    | "DISPUTED"
    | "EXPIRED";
  notes?: string;
  revealedOfferedCode?: string;
  revealedTargetCode?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SwapSchema = new Schema<ISwap>(
  {
    requesterId: { type: Schema.Types.Mixed, required: true, ref: "User", index: true },
    requestedId: { type: Schema.Types.Mixed, required: true, ref: "User", index: true },
    offeredVoucherId: { type: Schema.Types.Mixed, required: true, ref: "Voucher", index: true },
    targetVoucherId: { type: Schema.Types.Mixed, required: true, ref: "Voucher", index: true },
    status: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "DECLINED",
        "REJECTED",
        "CANCELLED",
        "CONFIRMATION_PENDING",
        "COMPLETED",
        "DISPUTED",
        "EXPIRED",
      ],
      default: "PENDING",
      index: true,
    },
    notes: { type: String, trim: true },
    revealedOfferedCode: { type: String },
    revealedTargetCode: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

SwapSchema.index({ requesterId: 1, status: 1 });
SwapSchema.index({ requestedId: 1, status: 1 });

export const Swap: Model<ISwap> =
  mongoose.models.Swap || mongoose.model<ISwap>("Swap", SwapSchema);

export default Swap;
