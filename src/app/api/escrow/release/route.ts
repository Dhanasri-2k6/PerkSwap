import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to confirm escrow release." },
        { status: 401 }
      );
    }
    const callerId = auth.userId;

    const body = await req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId is required." }, { status: 400 });
    }

    const tx = await db.transactions.findById(transactionId);
    if (!tx) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    if (String(tx.buyerId) !== String(callerId)) {
      return NextResponse.json(
        { error: "Forbidden: Only the verified buyer can release escrow funds." },
        { status: 403 }
      );
    }

    // Atomic Escrow Release (prevents concurrent double-release / race conditions)
    const updatedTx = await db.transactions.releaseEscrow(transactionId);
    if (!updatedTx) {
      return NextResponse.json(
        { error: "Transaction cannot be released. It has already been released, disputed, or refunded." },
        { status: 400 }
      );
    }

    // Release funds: Credit seller earnings
    const updatedSeller = await db.users.updateBalance(tx.sellerId, tx.sellerEarnings);
    try {
      await db.walletLedger.record({
        userId: tx.sellerId,
        type: "ESCROW_RELEASE",
        amount: tx.sellerEarnings,
        balanceAfter: updatedSeller?.walletBalance || 0,
        description: `Escrow payout released: +${tx.sellerEarnings} coins for sold voucher.`,
        referenceId: tx.id,
      });
    } catch (lErr) {
      console.error("Ledger record error:", lErr);
    }

    // Update voucher ownership and transfer to buyer as purchased asset
    await db.vouchers.update(tx.voucherId, {
      status: "SOLD",
      sellerId: tx.buyerId,
      originalSellerId: tx.sellerId,
      acquisitionSource: "PURCHASE",
      acquiredAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      transactionId: tx.id,
      sellerEarnings: tx.sellerEarnings,
      platformFee: tx.platformFee,
      message: `Escrow released! ₹${tx.sellerEarnings} credited to seller's wallet. Platform fee: ₹${tx.platformFee}.`,
    });
  } catch (error: any) {
    console.error("[Escrow Release API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to release escrow funds." }, { status: 500 });
  }
}
