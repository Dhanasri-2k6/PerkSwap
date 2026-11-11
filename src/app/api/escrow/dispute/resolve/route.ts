import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to mediate disputes." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { disputeId, action, resolutionNotes = "Resolved by PerkSwap mediator." } = body;

    if (!disputeId || !action) {
      return NextResponse.json(
        { error: "disputeId and action (RESOLVE_REFUND | RESOLVE_RELEASE) are required." },
        { status: 400 }
      );
    }

    const dispute = await db.disputes.findById(disputeId);
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found." }, { status: 404 });
    }

    if (dispute.status !== "OPEN") {
      return NextResponse.json(
        { error: `This dispute has already been resolved with status: ${dispute.status}.` },
        { status: 400 }
      );
    }

    const tx = await db.transactions.findById(dispute.transactionId);
    if (!tx) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    if (action === "RESOLVE_REFUND") {
      // 1. Atomically update transaction to REFUNDED
      const updatedTx = await db.transactions.refundEscrow(tx.id || tx._id);
      if (!updatedTx) {
        return NextResponse.json(
          { error: "Failed to refund escrow. The transaction might already be settled." },
          { status: 400 }
        );
      }

      // 2. Return locked funds to buyer's wallet
      await db.users.updateBalance(tx.buyerId, tx.amount);

      // 3. Mark voucher as CANCELLED
      await db.vouchers.update(tx.voucherId, { status: "CANCELLED" });

      // 4. Update dispute record
      const resolvedDispute = await db.disputes.update(dispute.id || dispute._id, {
        status: "RESOLVED_REFUND",
        resolutionNotes,
        resolvedAt: new Date(),
        resolvedBy: auth.email || auth.userId,
      });

      return NextResponse.json({
        success: true,
        action: "RESOLVE_REFUND",
        message: `Dispute resolved in favor of buyer. ₹${tx.amount.toFixed(2)} refunded to buyer's wallet.`,
        dispute: resolvedDispute,
        transactionStatus: "REFUNDED",
      });
    } else if (action === "RESOLVE_RELEASE") {
      // 1. Atomically update transaction to RELEASED
      const updatedTx = await db.transactions.releaseEscrow(tx.id || tx._id);
      if (!updatedTx) {
        return NextResponse.json(
          { error: "Failed to release escrow. The transaction might already be settled." },
          { status: 400 }
        );
      }

      // 2. Release seller earnings to seller's wallet
      await db.users.updateBalance(tx.sellerId, tx.sellerEarnings);

      // 3. Mark voucher as SOLD
      await db.vouchers.update(tx.voucherId, { status: "SOLD" });

      // 4. Update dispute record
      const resolvedDispute = await db.disputes.update(dispute.id || dispute._id, {
        status: "RESOLVED_RELEASE",
        resolutionNotes,
        resolvedAt: new Date(),
        resolvedBy: auth.email || auth.userId,
      });

      return NextResponse.json({
        success: true,
        action: "RESOLVE_RELEASE",
        message: `Dispute resolved in favor of seller. ₹${tx.sellerEarnings.toFixed(2)} credited to seller's wallet.`,
        dispute: resolvedDispute,
        transactionStatus: "RELEASED",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Supported actions: RESOLVE_REFUND, RESOLVE_RELEASE." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("[Dispute Resolve API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resolve dispute." },
      { status: 500 }
    );
  }
}
