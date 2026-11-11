import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const CreateVoucherSchema = z
  .object({
    brand: z.string().min(2, "Brand must be at least 2 characters").max(60),
    category: z
      .enum(["FOOD", "SHOPPING", "TRAVEL", "ENTERTAINMENT", "TECH", "OTHER"])
      .default("SHOPPING"),
    title: z.string().optional(),
    description: z.string().optional(),
    code: z.string().min(3, "Voucher code must be at least 3 characters").max(64),
    discountType: z.enum(["FLAT", "PERCENTAGE"]).default("FLAT"),
    faceValue: z.number().positive("Face value must be positive"),
    originalValue: z.number().optional(),
    sellingPrice: z.number().min(10, "Selling price must be at least ₹10"),
    aiRecommendedPrice: z.number().optional(),
    maxDiscount: z.number().positive().optional(),
    minSpend: z.number().min(0).default(0),
    expiryDate: z.string().refine(
      (val) => {
        const time = Date.parse(val);
        return !isNaN(time) && time > Date.now();
      },
      { message: "Expiry date must be a valid future date" }
    ),
    fraudRiskScore: z.number().min(0).max(100).default(0),
    termsAndConditions: z.array(z.string()).default([]),
    rawOcrText: z.string().optional(),
    imageUrl: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.discountType === "PERCENTAGE") {
        return data.faceValue <= 100;
      }
      return data.sellingPrice <= data.faceValue;
    },
    {
      message:
        "Percentage discount cannot exceed 100%, and flat selling price cannot exceed face value",
      path: ["sellingPrice"],
    }
  );

export const InitiateEscrowSchema = z.object({
  voucherId: z.string().uuid("Invalid voucher ID"),
});

export const ReleaseEscrowSchema = z.object({
  transactionId: z.string().uuid("Invalid transaction ID"),
});

export const DisputeEscrowSchema = z.object({
  transactionId: z.string().uuid("Invalid transaction ID"),
  reason: z.string().min(10, "Please provide detailed reason for the dispute (at least 10 characters)"),
  evidenceUrl: z.string().optional(),
});

export const ProposeSwapSchema = z.object({
  offeredVoucherId: z.string().uuid("Invalid offered voucher ID"),
  targetVoucherId: z.string().uuid("Invalid target voucher ID"),
  notes: z.string().max(300).optional(),
});

export const AcceptSwapSchema = z.object({
  swapRequestId: z.string().uuid("Invalid swap request ID"),
});

export const RecommendCouponsSchema = z.object({
  prompt: z.string().min(3, "Prompt must be at least 3 characters"),
  estimatedCartAmount: z.number().optional(),
  brand: z.string().optional(),
});

export const CreatePaymentOrderSchema = z
  .object({
    packageId: z.string().min(1, "packageId is required"),
  })
  .strict();

export const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, "razorpay_order_id is required"),
  razorpay_payment_id: z.string().min(1, "razorpay_payment_id is required"),
  razorpay_signature: z.string().min(1, "razorpay_signature is required"),
});
