import mongoose, { Schema, Document, Model } from "mongoose";

export type WalletTransactionType =
  | "STARTER_GRANT"
  | "PACKAGE_PURCHASE"
  | "ESCROW_LOCK"
  | "ESCROW_RELEASE"
  | "ESCROW_REFUND"
  | "DIRECT_TRANSFER";

export interface IWalletLedger extends Document {
  userId: mongoose.Types.ObjectId | string;
  type: WalletTransactionType;
  amount: number; // positive for credit, negative for debit
  balanceAfter: number;
  description: string;
  referenceId?: string;
  metadata?: any;
  createdAt: Date;
}

const WalletLedgerSchema = new Schema<IWalletLedger>(
  {
    userId: { type: Schema.Types.Mixed, required: true, ref: "User", index: true },
    type: {
      type: String,
      enum: [
        "STARTER_GRANT",
        "PACKAGE_PURCHASE",
        "ESCROW_LOCK",
        "ESCROW_RELEASE",
        "ESCROW_REFUND",
        "DIRECT_TRANSFER",
      ],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true },
    referenceId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

WalletLedgerSchema.index({ userId: 1, createdAt: -1 });

export const WalletLedger: Model<IWalletLedger> =
  mongoose.models.WalletLedger ||
  mongoose.model<IWalletLedger>("WalletLedger", WalletLedgerSchema);

export default WalletLedger;
