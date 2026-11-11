import mongoose, { Schema, Document, Model } from "mongoose";

export type VoucherStatus =
  | "ACTIVE"
  | "PENDING_REVIEW"
  | "REJECTED"
  | "IN_ESCROW"
  | "SOLD"
  | "SWAPPED"
  | "DISPUTED"
  | "EXPIRED"
  | "CANCELLED";

export type DiscountType = "FLAT" | "PERCENTAGE";
export type VerificationStatus = "UNVERIFIED" | "MERCHANT_VERIFIED" | "FAILED";
export type AcquisitionSource = "UPLOAD" | "PURCHASE" | "SWAP";

export interface IVoucher extends Document {
  sellerId: mongoose.Types.ObjectId | string;
  originalSellerId?: mongoose.Types.ObjectId | string;
  acquisitionSource?: AcquisitionSource;
  acquiredAt?: Date;
  brand: string;
  category: "FOOD" | "SHOPPING" | "TRAVEL" | "ENTERTAINMENT" | "TECH" | "OTHER";
  title?: string;
  description?: string;
  encryptedCode: string;
  iv: string;
  tag: string;
  codeHash: string; // HMAC-SHA-256 for deterministic duplicate detection
  discountType: DiscountType;
  faceValue: number;
  originalValue?: number;
  maxDiscount?: number;
  sellingPrice: number;
  minSpend: number;
  expiryDate: Date;
  status: VoucherStatus;
  verificationStatus: VerificationStatus;
  verifiedAt?: Date;
  verificationNotes?: string;
  fraudRiskScore: number;
  reviewFlags: string[];
  rawOcrText?: string;
  termsAndConditions?: string[];
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VoucherSchema = new Schema<IVoucher>(
  {
    sellerId: { type: Schema.Types.Mixed, required: true, ref: "User", index: true },
    originalSellerId: { type: Schema.Types.Mixed, ref: "User", index: true },
    acquisitionSource: {
      type: String,
      enum: ["UPLOAD", "PURCHASE", "SWAP"],
      default: "UPLOAD",
      index: true,
    },
    acquiredAt: { type: Date, default: Date.now },
    brand: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      enum: ["FOOD", "SHOPPING", "TRAVEL", "ENTERTAINMENT", "TECH", "OTHER"],
      default: "SHOPPING",
      index: true,
    },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    encryptedCode: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    codeHash: { type: String, required: true, unique: true, index: true },
    discountType: {
      type: String,
      enum: ["FLAT", "PERCENTAGE"],
      default: "FLAT",
    },
    faceValue: { type: Number, required: true, min: 1 },
    originalValue: { type: Number, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    sellingPrice: { type: Number, required: true, min: 1 },
    minSpend: { type: Number, default: 0, min: 0 },
    expiryDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "PENDING_REVIEW",
        "REJECTED",
        "IN_ESCROW",
        "SOLD",
        "SWAPPED",
        "DISPUTED",
        "EXPIRED",
        "CANCELLED",
      ],
      default: "ACTIVE",
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED", "MERCHANT_VERIFIED", "FAILED"],
      default: "UNVERIFIED",
      index: true,
    },
    verifiedAt: { type: Date },
    verificationNotes: { type: String },
    fraudRiskScore: { type: Number, default: 0, min: 0, max: 100 },
    reviewFlags: { type: [String], default: [] },
    rawOcrText: { type: String },
    termsAndConditions: { type: [String], default: [] },
    imageUrl: { type: String },
  },
  { timestamps: true }
);

// Compound indexes for optimal queries
VoucherSchema.index({ status: 1, expiryDate: 1 });
VoucherSchema.index({ sellerId: 1, status: 1 });
VoucherSchema.index({ codeHash: 1 }, { unique: true });

export const Voucher: Model<IVoucher> =
  mongoose.models.Voucher || mongoose.model<IVoucher>("Voucher", VoucherSchema);

export default Voucher;
