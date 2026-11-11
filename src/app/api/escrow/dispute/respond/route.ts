import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to respond to the dispute." },
        { status: 401 }
      );
    }
    const sellerId = auth.userId;

    const body = await req.json();
    const { disputeId, transactionId, sellerResponse } = body;

    if (!sellerResponse || sellerResponse.trim().length === 0) {
      return NextResponse.json(
        { error: "A valid seller response explanation is required." },
        { status: 400 }
      );
    }

    let dispute: any = null;
    if (disputeId) {
      dispute = await db.disputes.findById(disputeId);
    } else if (transactionId) {
      dispute = await db.disputes.findByTransactionId(transactionId);
    }

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found." }, { status: 404 });
    }

    const tx = await db.transactions.findById(dispute.transactionId);
    if (!tx) {
      return NextResponse.json({ error: "Associated transaction not found." }, { status: 404 });
    }

    // Security check: Only the seller of this transaction can provide a seller response
    if (String(tx.sellerId) !== String(sellerId)) {
      return NextResponse.json(
        { error: "Forbidden: Only the seller for this transaction can provide a seller response." },
        { status: 403 }
      );
    }

    if (dispute.status !== "OPEN") {
      return NextResponse.json(
        { error: `Cannot submit response. Dispute is already ${dispute.status}.` },
        { status: 400 }
      );
    }

    const updatedDispute = await db.disputes.update(dispute.id || dispute._id, {
      sellerResponse: sellerResponse.trim(),
      sellerResponseAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Seller response submitted successfully. A mediator will review both statements.",
      dispute: updatedDispute,
    });
  } catch (error: any) {
    console.error("[Dispute Respond API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit seller response." },
      { status: 500 }
    );
  }
}
