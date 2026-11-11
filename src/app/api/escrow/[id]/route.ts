import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptVoucherCode } from "@/lib/crypto";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const { id } = await params;
    const tx = await db.transactions.findById(id);

    if (!tx) {
      return NextResponse.json({ error: "Escrow transaction not found." }, { status: 404 });
    }

    const isBuyer = String(tx.buyerId) === String(auth.userId);
    const isSeller = String(tx.sellerId) === String(auth.userId);

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: "Forbidden: You are neither the buyer nor seller in this escrow." },
        { status: 403 }
      );
    }

    const voucher = await db.vouchers.findById(tx.voucherId);
    let unmaskedCode: string | null = null;

    if (voucher) {
      const cipher = voucher.encryptedCode || voucher.code;
      const iv = voucher.iv || voucher.codeIv;
      const tag = voucher.tag || voucher.codeTag;

      if (cipher && iv && tag) {
        try {
          unmaskedCode = decryptVoucherCode(cipher, iv, tag);
        } catch (e) {
          console.error("Code decryption failed:", e);
        }
      }
    }

    const dispute = await db.disputes.findByTransactionId(id);

    return NextResponse.json({
      success: true,
      transaction: {
        id: tx.id || tx._id,
        amount: tx.amount,
        platformFee: tx.platformFee,
        sellerEarnings: tx.sellerEarnings,
        status: tx.status,
        inspectionExpiresAt: tx.inspectionExpiresAt,
        expiresAt: tx.inspectionExpiresAt,
        releasedAt: tx.releasedAt,
        refundedAt: tx.refundedAt,
        isBuyer,
        isSeller,
        voucher: voucher
          ? {
              id: voucher.id || voucher._id,
              brand: voucher.brand,
              title: voucher.title,
              faceValue: voucher.faceValue,
              sellingPrice: voucher.sellingPrice,
              verificationStatus: voucher.verificationStatus,
            }
          : {
              id: tx.voucherId,
              brand: "Voucher",
              title: "PerkSwap Voucher",
              faceValue: tx.amount,
              sellingPrice: tx.amount,
              verificationStatus: "UNVERIFIED",
            },
        unmaskedCode: unmaskedCode || "PERK-CODE-ACTIVE",
        dispute: dispute || null,
      },
    });
  } catch (error: any) {
    console.error("[Escrow Detail API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load escrow details." },
      { status: 500 }
    );
  }
}
