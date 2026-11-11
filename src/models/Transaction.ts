import mongoose, { Schema, Document, Model } from "mongoose";

export type EscrowStatus = "HELD_IN_ESCROW" | "RELEASED" | "REFUNDED" | "DISPUTED" | "CANCELLED";

export interface ITransaction extends Document {
  buyerId: mongoose.Types.ObjectId | string;
  sellerId: mongoose.Types.ObjectId | string;
  voucherId: mongoose.Types.ObjectId | string;
  amount: number;
  platformFee: number;
  sellerEarnings: number;
  status: EscrowStatus;
  inspectionExpiresAt: Date;
  releasedAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    buyerId: { type: Schema.Types.Mixed, required: true, ref: "User", index: true },
    sellerId: { type: Schema.Types.Mixed, required: true, ref: "User", index: true },
    voucherId: { type: Schema.Types.Mixed, required: true, ref: "Voucher", index: true },
    amount: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 },
    sellerEarnings: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["HELD_IN_ESCROW", "RELEASED", "REFUNDED", "DISPUTED", "CANCELLED"],
      default: "HELD_IN_ESCROW",
      index: true,
    },
    inspectionExpiresAt: { type: Date, required: true, index: true },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true }
);

TransactionSchema.index({ buyerId: 1, status: 1 });
TransactionSchema.index({ sellerId: 1, status: 1 });

export const Transaction: Model<ITransaction> =
  mongoose.models.Transaction || mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
