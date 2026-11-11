import { DiscountType } from "./aiVision";

export type RiskReviewResult = {
  isValid: boolean;
  validationErrors: string[];
  reviewStatus: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
  fraudRiskScore: number;
  reviewFlags: string[];
  reasons: string[];
};

const GENERIC_CODE_PATTERNS = [
  /^COUPON$/i,
  /^OFFER$/i,
  /^PROMO$/i,
  /^DISCOUNT$/i,
  /^TEST$/i,
  /^CODE$/i,
  /^SAMPLE$/i,
  /^FREE$/i,
  /^REWARD$/i,
  /^XXXX+$/i,
  /^1234+$/i,
];

/**
 * Deterministic Server-Side Rule-Based Validation & Risk Engine
 */
export function evaluateVoucherRisk(params: {
  brand: string;
  code: string;
  discountType: DiscountType;
  faceValue: number;
  originalValue?: number;
  maxDiscount?: number;
  sellingPrice: number;
  minSpend?: number;
  expiryDate: string | Date;
  aiFraudScore?: number;
  sellerTrustScore?: number;
  sellerCompletedTrades?: number;
}): RiskReviewResult {
  const validationErrors: string[] = [];
  const reviewFlags: string[] = [];
  const reasons: string[] = [];

  const {
    brand,
    code,
    discountType,
    faceValue,
    sellingPrice,
    maxDiscount = faceValue,
    minSpend = 0,
    expiryDate,
    aiFraudScore = 0,
    sellerTrustScore = 85,
    sellerCompletedTrades = 0,
  } = params;

  // -------------------------------------------------------------
  // 1. HARD RULE VALIDATION (Rejects immediately if violated)
  // -------------------------------------------------------------

  // Brand check
  if (!brand || typeof brand !== "string" || brand.trim().length < 2) {
    validationErrors.push("Brand name must be at least 2 characters long.");
  }

  // Code validation
  const cleanCode = (code || "").trim();
  if (!cleanCode || cleanCode.length < 3) {
    validationErrors.push("Voucher code must be at least 3 characters long.");
  }
  if (cleanCode.length > 64) {
    validationErrors.push("Voucher code exceeds maximum allowed length of 64 characters.");
  }

  for (const pattern of GENERIC_CODE_PATTERNS) {
    if (pattern.test(cleanCode)) {
      validationErrors.push(`Voucher code '${cleanCode}' is a generic placeholder and cannot be listed.`);
      break;
    }
  }

  // Value checks
  if (typeof faceValue !== "number" || isNaN(faceValue) || faceValue <= 0) {
    validationErrors.push("Face value must be a positive number.");
  }

  if (typeof sellingPrice !== "number" || isNaN(sellingPrice) || sellingPrice <= 0) {
    validationErrors.push("Selling price must be a positive number.");
  }

  if (sellingPrice < 10) {
    validationErrors.push("Selling price cannot be below the platform floor of ₹10.");
  }

  // Discount Type specifics
  if (discountType === "PERCENTAGE") {
    if (faceValue > 100) {
      validationErrors.push("Percentage discount face value cannot exceed 100%.");
    }
    if (maxDiscount <= 0) {
      validationErrors.push("Maximum savings cap must be positive for percentage discounts.");
    }
    if (sellingPrice > maxDiscount) {
      validationErrors.push(`Selling price (₹${sellingPrice}) cannot exceed maximum savings cap (₹${maxDiscount}).`);
    }
  } else {
    // Flat Cash / Gift Card
    if (sellingPrice > faceValue) {
      validationErrors.push(`Selling price (₹${sellingPrice}) cannot exceed the voucher face value (₹${faceValue}).`);
    }
  }

  // Min Spend check
  if (minSpend < 0) {
    validationErrors.push("Minimum order spend cannot be negative.");
  }

  // Expiry Date Validation (Must be strictly in future)
  const expTime = new Date(expiryDate).getTime();
  const now = Date.now();

  if (isNaN(expTime)) {
    validationErrors.push("Invalid voucher expiry date format.");
  } else if (expTime <= now) {
    validationErrors.push("Coupon has already expired. Expired vouchers cannot be listed on PerkSwap.");
  } else {
    const hoursRemaining = (expTime - now) / (1000 * 60 * 60);
    // Must be at least 2 hours in the future to allow for the escrow inspection window
    if (hoursRemaining < 2) {
      validationErrors.push("Voucher must expire at least 2 hours in the future to accommodate the escrow inspection window.");
    }
  }

  // If hard rules failed, reject immediately
  if (validationErrors.length > 0) {
    return {
      isValid: false,
      validationErrors,
      reviewStatus: "REJECTED",
      fraudRiskScore: 100,
      reviewFlags: ["HARD_VALIDATION_FAILURE"],
      reasons: validationErrors,
    };
  }

  // -------------------------------------------------------------
  // 2. RISK-BASED SCORING & REVIEW GATING
  // -------------------------------------------------------------
  let calculatedRiskScore = 0;

  // A. High Face Value Rule (> ₹10,000 requires admin review)
  if (faceValue > 10000) {
    calculatedRiskScore += 35;
    reviewFlags.push("HIGH_FACE_VALUE");
    reasons.push(`High face value voucher (₹${faceValue.toLocaleString()}) requires manual verification.`);
  }

  // B. Tight Expiry Window (< 12 hours)
  const hoursRemaining = (expTime - now) / (1000 * 60 * 60);
  if (hoursRemaining < 12) {
    calculatedRiskScore += 20;
    reviewFlags.push("TIGHT_EXPIRY_WINDOW");
    reasons.push(`Voucher expires in only ${hoursRemaining.toFixed(1)} hours.`);
  }

  // C. Unusually High Discount Ratio (> 90% off for high face value)
  if (discountType === "FLAT" && faceValue > 2000 && sellingPrice < faceValue * 0.1) {
    calculatedRiskScore += 25;
    reviewFlags.push("ABNORMAL_DISCOUNT_RATIO");
    reasons.push("Selling price is over 90% below face value for a high-value card.");
  }

  // D. Seller Reputation Signals
  if (sellerTrustScore < 70) {
    calculatedRiskScore += 30;
    reviewFlags.push("LOW_SELLER_TRUST");
    reasons.push(`Seller trust rating (${sellerTrustScore}/100) is below standard threshold.`);
  }

  if (sellerCompletedTrades === 0 && faceValue > 5000) {
    calculatedRiskScore += 25;
    reviewFlags.push("NEW_SELLER_HIGH_VALUE");
    reasons.push("New seller with 0 completed trades listing high-value voucher.");
  }

  // E. AI Vision / OCR Fraud Risk Score as supporting signal (not sole decider)
  const safeAiScore = Math.min(100, Math.max(0, Number(aiFraudScore) || 0));
  if (safeAiScore > 40) {
    calculatedRiskScore += Math.round(safeAiScore * 0.4);
    reviewFlags.push("AI_FRAUD_FLAG");
    reasons.push(`AI OCR inspection flagged potential tampering (score: ${safeAiScore}).`);
  }

  const finalRiskScore = Math.min(100, calculatedRiskScore);

  // Status Decision:
  // If risk score >= 50 or critical flags present -> PENDING_REVIEW
  // Otherwise -> APPROVED (can be listed as ACTIVE)
  const requiresReview =
    finalRiskScore >= 50 ||
    reviewFlags.includes("HIGH_FACE_VALUE") ||
    reviewFlags.includes("LOW_SELLER_TRUST") ||
    reviewFlags.includes("LOW_SELLER_TRUST_SCORE");

  const reviewStatus: "APPROVED" | "PENDING_REVIEW" = requiresReview
    ? "PENDING_REVIEW"
    : "APPROVED";

  return {
    isValid: true,
    validationErrors: [],
    reviewStatus,
    fraudRiskScore: finalRiskScore,
    reviewFlags,
    reasons,
  };
}
