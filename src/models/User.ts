import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  walletBalance: number;
  hasReceivedStarterGrant?: boolean;
  trustScore: number;
  verified: boolean;
  completedTrades: number;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    walletBalance: { type: Number, default: 150.0, min: 0 },
    hasReceivedStarterGrant: { type: Boolean, default: false },
    trustScore: { type: Number, default: 85, min: 0, max: 100 },
    verified: { type: Boolean, default: true },
    completedTrades: { type: Number, default: 0, min: 0 },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
