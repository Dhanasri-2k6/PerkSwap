import mongoose, { Schema, Document, Model } from "mongoose";

export type PaymentStatus = "created" | "pending" | "captured" | "failed";

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId | string;
  packageId: string;
  packageTitle: string;
  coins: number;
  bonusCoins: number;
  totalCoins: number;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number; // In paise (smallest INR currency unit)
  amountInr: number; // Display amount in INR
  currency: "INR";
  status: PaymentStatus;
  paymentMethod?: string;
  razorpaySignatureVerified: boolean;
  coinsCredited: boolean;
  creditedAt?: Date;
  processedWebhookEvents: string[];
  receipt?: string;
  mode: "test";
  failureCode?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.Mixed, required: true, ref: "User", index: true },
    packageId: { type: String, required: true },
    packageTitle: { type: String, required: true },
    coins: { type: Number, required: true, min: 1 },
    bonusCoins: { type: Number, default: 0, min: 0 },
    totalCoins: { type: Number, required: true, min: 1 },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    amount: { type: Number, required: true, min: 100 },
    amountInr: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR", enum: ["INR"] },
    status: {
      type: String,
      enum: ["created", "pending", "captured", "failed"],
      default: "created",
      index: true,
    },
    paymentMethod: { type: String },
    razorpaySignatureVerified: { type: Boolean, default: false },
    coinsCredited: { type: Boolean, default: false, index: true },
    creditedAt: { type: Date },
    processedWebhookEvents: { type: [String], default: [] },
    receipt: { type: String },
    mode: { type: String, enum: ["test"], default: "test", required: true },
    failureCode: { type: String },
    failureReason: { type: String },
  },
  { timestamps: true }
);

PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { razorpayPaymentId: { $type: "string" } },
  }
);

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
