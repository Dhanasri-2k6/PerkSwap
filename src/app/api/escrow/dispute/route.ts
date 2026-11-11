import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to raise a dispute." },
        { status: 401 }
      );
    }
    const buyerId = auth.userId;

    const body = await req.json();
    const { transactionId, reason, evidenceUrl } = body;

    if (!transactionId || !reason) {
      return NextResponse.json({ error: "transactionId and reason are required." }, { status: 400 });
    }

    const tx = await db.transactions.findById(transactionId);
    if (!tx) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    if (String(tx.buyerId) !== String(buyerId)) {
      return NextResponse.json(
        { error: "Forbidden: Only the buyer who initiated this transaction can raise a dispute." },
        { status: 403 }
      );
    }

    if (tx.status !== "HELD_IN_ESCROW") {
      return NextResponse.json(
        { error: `Cannot dispute transaction in status: ${tx.status}.` },
        { status: 400 }
      );
    }

    // Freeze escrow & mark transaction and voucher as DISPUTED
    await db.transactions.update(transactionId, { status: "DISPUTED" });
    await db.vouchers.update(tx.voucherId, { status: "DISPUTED" });

    const dispute = await db.disputes.create({
      transactionId,
      initiatorId: buyerId,
      reason,
      evidenceUrl,
      status: "OPEN",
    });

    return NextResponse.json({
      success: true,
      disputeId: dispute.id,
      message: "Dispute opened. Escrow funds frozen until mediator resolution or seller refund.",
      policyDisclaimer:
        "Important Policy Notice: Raising a dispute securely pauses the escrow countdown. Submitting a report does NOT grant an instant automatic refund. The seller has an opportunity to respond with proof of validity, or an admin mediator will review evidence from both parties to decide a fair outcome.",
    });
  } catch (error: any) {
    console.error("[Escrow Dispute API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to raise dispute." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("transactionId");
    const disputeId = searchParams.get("disputeId");

    let dispute: any = null;
    if (disputeId) {
      dispute = await db.disputes.findById(disputeId);
    } else if (transactionId) {
      dispute = await db.disputes.findByTransactionId(transactionId);
    }

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      dispute,
    });
  } catch (error: any) {
    console.error("[Escrow Dispute GET API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch dispute." }, { status: 500 });
  }
}
