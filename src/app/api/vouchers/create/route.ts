import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  encryptVoucherCode,
  maskVoucherCode,
  normalizeVoucherCode,
  generateVoucherCodeHash,
} from "@/lib/crypto";
import { db } from "@/lib/db";
import { evaluateVoucherRisk } from "@/services/riskEngine";
import { checkMerchantVerification } from "@/services/merchantVerification";

export async function POST(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to create a voucher listing." },
        { status: 401 }
      );
    }
    const sellerId = auth.userId;

    const seller = await db.users.findById(sellerId);
    if (!seller) {
      return NextResponse.json({ error: "Seller profile not found." }, { status: 404 });
    }

    const body = await req.json();
    const {
      brand,
      category = "SHOPPING",
      title,
      description,
      code,
      discountType = "FLAT",
      faceValue,
      originalValue,
      maxDiscount,
      sellingPrice,
      minSpend = 0,
      expiryDate,
      fraudRiskScore = 0,
      rawOcrText,
      termsAndConditions = [],
      imageUrl,
    } = body;

    // -------------------------------------------------------------
    // 1. RULE-BASED VALIDATION & RISK ENGINE
    // -------------------------------------------------------------
    const riskEvaluation = evaluateVoucherRisk({
      brand,
      code,
      discountType,
      faceValue: Number(faceValue),
      originalValue: originalValue !== undefined ? Number(originalValue) : Number(faceValue),
      maxDiscount: maxDiscount !== undefined ? Number(maxDiscount) : Number(faceValue),
      sellingPrice: Number(sellingPrice),
      minSpend: Number(minSpend) || 0,
      expiryDate,
      aiFraudScore: Number(fraudRiskScore) || 0,
      sellerTrustScore: seller.trustScore,
      sellerCompletedTrades: seller.completedTrades,
    });

    if (!riskEvaluation.isValid) {
      return NextResponse.json(
        {
          error: "Validation failed: " + riskEvaluation.validationErrors.join(" "),
          details: riskEvaluation.validationErrors,
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------
    // 2. DUPLICATE DETECTION (Normalized HMAC-SHA-256)
    // -------------------------------------------------------------
    const cleanCode = normalizeVoucherCode(code);
    const codeHash = generateVoucherCodeHash(cleanCode);

    const existingVoucher = await db.vouchers.findByCodeHash(codeHash);
    if (existingVoucher) {
      return NextResponse.json(
        {
          error: "Duplicate Voucher: A coupon with this exact claim code has already been listed, sold, or traded on PerkSwap.",
          code: "DUPLICATE_VOUCHER_CODE",
        },
        { status: 409 }
      );
    }

    // -------------------------------------------------------------
    // 3. MERCHANT VERIFICATION
    // -------------------------------------------------------------
    const merchantResult = await checkMerchantVerification({
      brand,
      code: cleanCode,
      faceValue: Number(faceValue),
    });

    // -------------------------------------------------------------
    // 4. RISK-BASED REVIEW STATUS DECISION
    // -------------------------------------------------------------
    // If flagged by risk engine, status is PENDING_REVIEW (cannot be bought or seen publicly)
    const initialStatus =
      riskEvaluation.reviewStatus === "PENDING_REVIEW"
        ? "PENDING_REVIEW"
        : "ACTIVE";

    // -------------------------------------------------------------
    // 5. AES-256-GCM ENCRYPTION & SECURE STORAGE
    // -------------------------------------------------------------
    const encrypted = encryptVoucherCode(cleanCode);

    const voucher = await db.vouchers.create({
      sellerId,
      brand: brand.trim(),
      category,
      title:
        title ||
        `${brand} ${discountType === "PERCENTAGE" ? `${faceValue}% OFF` : `Flat ₹${faceValue} OFF`}`,
      description:
        description || `Verified ${brand} voucher. Applicable on orders above ₹${minSpend}.`,
      encryptedCode: encrypted.ciphertext,
      code: encrypted.ciphertext,
      iv: encrypted.iv,
      codeIv: encrypted.iv,
      tag: encrypted.tag,
      codeTag: encrypted.tag,
      codeHash, // Deterministic indexable hash
      discountType,
      faceValue: Number(faceValue),
      originalValue: originalValue ? Number(originalValue) : Number(faceValue),
      maxDiscount: maxDiscount ? Number(maxDiscount) : Number(faceValue),
      sellingPrice: Number(sellingPrice),
      minSpend: Number(minSpend) || 0,
      expiryDate: new Date(expiryDate),
      status: initialStatus,
      verificationStatus: merchantResult.status,
      verifiedAt: merchantResult.verifiedAt,
      verificationNotes: merchantResult.notes,
      fraudRiskScore: riskEvaluation.fraudRiskScore,
      reviewFlags: riskEvaluation.reviewFlags,
      rawOcrText: rawOcrText || "",
      termsAndConditions,
      imageUrl:
        imageUrl ||
        "https://images.unsplash.com/photo-1556742049-0a67e557224f?w=600&auto=format&fit=crop&q=60",
    });

    const isPendingReview = initialStatus === "PENDING_REVIEW";

    return NextResponse.json({
      success: true,
      status: voucher.status,
      isPendingReview,
      message: isPendingReview
        ? "Listing submitted! Because this voucher carries high value or risk flags, it is currently in PENDING_REVIEW status and will be published once reviewed."
        : "Voucher listed successfully on the marketplace!",
      voucher: {
        id: voucher.id,
        brand: voucher.brand,
        title: voucher.title,
        sellingPrice: voucher.sellingPrice,
        faceValue: voucher.faceValue,
        status: voucher.status,
        verificationStatus: voucher.verificationStatus,
        maskedCode: maskVoucherCode(cleanCode), // Never return raw code
      },
    });
  } catch (error: any) {
    console.error("[Voucher Create API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create voucher listing." },
      { status: 500 }
    );
  }
}
