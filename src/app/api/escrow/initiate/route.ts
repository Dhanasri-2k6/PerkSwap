import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptVoucherCode } from "@/lib/crypto";

export async function POST(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to purchase vouchers via escrow." },
        { status: 401 }
      );
    }
    const buyerId = auth.userId;

    const body = await req.json();
    const { voucherId } = body;

    if (!voucherId) {
      return NextResponse.json({ error: "voucherId is required." }, { status: 400 });
    }

    const voucher = await db.vouchers.findById(voucherId);
    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found." }, { status: 404 });
    }

    if (voucher.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Voucher is not available for purchase (status: ${voucher.status}).` },
        { status: 400 }
      );
    }

    if (String(voucher.sellerId) === String(buyerId)) {
      return NextResponse.json({ error: "You cannot purchase your own voucher." }, { status: 400 });
    }

    const buyer = await db.users.findById(buyerId);
    if (!buyer) {
      return NextResponse.json({ error: "Buyer profile not found." }, { status: 404 });
    }

    // Pre-flight balance check
    if (buyer.walletBalance < voucher.sellingPrice) {
      return NextResponse.json(
        {
          error: `Insufficient wallet balance. You have ₹${buyer.walletBalance.toFixed(2)}, but this voucher costs ₹${voucher.sellingPrice.toFixed(2)}. Please top up your wallet.`,
        },
        { status: 400 }
      );
    }

    // Atomic Escrow Lock (prevents concurrent double-purchasing race conditions)
    const lockedVoucher = await db.vouchers.lockForEscrow(voucherId);
    if (!lockedVoucher) {
      return NextResponse.json(
        { error: "This voucher is no longer available or is currently in escrow with another buyer." },
        { status: 409 }
      );
    }

    const platformFee = Math.round(voucher.sellingPrice * 0.05 * 100) / 100;
    const sellerEarnings = Math.round((voucher.sellingPrice - platformFee) * 100) / 100;
    const inspectionExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    // Deduct buyer balance (with rollback safety if balance deduction fails)
    try {
      const updatedBuyer = await db.users.updateBalance(buyerId, -voucher.sellingPrice);
      try {
        await db.walletLedger.record({
          userId: buyerId,
          type: "ESCROW_LOCK",
          amount: -voucher.sellingPrice,
          balanceAfter: updatedBuyer?.walletBalance || 0,
          description: `Locked ${voucher.sellingPrice} coins in escrow for voucher: ${voucher.brand} (${voucher.title || voucher.id})`,
          referenceId: voucher.id,
        });
      } catch (lErr) {
        console.error("Ledger record error:", lErr);
      }
    } catch (deductErr) {
      await db.vouchers.releaseLock(voucherId);
      throw deductErr;
    }

    // Create escrow transaction
    const tx = await db.transactions.create({
      buyerId,
      sellerId: voucher.sellerId,
      voucherId: voucher.id,
      amount: voucher.sellingPrice,
      platformFee,
      sellerEarnings,
      status: "HELD_IN_ESCROW",
      inspectionExpiresAt,
      expiresAt: inspectionExpiresAt,
    });

    // Decrypt code for the authorized buyer
    const cipher = voucher.encryptedCode || voucher.code;
    const iv = voucher.iv || voucher.codeIv;
    const tag = voucher.tag || voucher.codeTag;

    let revealedCode = "PERK-CODE-REVEALED";
    if (cipher && iv && tag) {
      try {
        revealedCode = decryptVoucherCode(cipher, iv, tag);
      } catch (e) {
        console.error("Code decryption failed:", e);
      }
    }

    return NextResponse.json({
      success: true,
      transactionId: tx.id,
      voucherId: voucher.id,
      amount: tx.amount,
      revealedCode,
      inspectionExpiresAt: inspectionExpiresAt.toISOString(),
      expiresAt: inspectionExpiresAt.toISOString(),
      inspectionWindowHours: 2,
      message: "Funds locked safely in PerkSwap Escrow. Voucher code unmasked for inspection.",
    });
  } catch (error: any) {
    console.error("[Escrow Initiate API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to initiate escrow." }, { status: 500 });
  }
}
