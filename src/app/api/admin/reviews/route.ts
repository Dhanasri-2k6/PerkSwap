import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    // Retrieve pending review vouchers
    const pendingVouchers = await db.vouchers.findMany({ status: "PENDING_REVIEW" });

    return NextResponse.json({
      success: true,
      count: pendingVouchers.length,
      vouchers: pendingVouchers,
    });
  } catch (error: any) {
    console.error("[Admin Reviews GET API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch pending reviews." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const body = await req.json();
    const { voucherId, action, reviewNotes } = body;

    if (!voucherId || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "voucherId and a valid action ('APPROVE' or 'REJECT') are required." },
        { status: 400 }
      );
    }

    const voucher = await db.vouchers.findById(voucherId);
    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found." }, { status: 404 });
    }

    if (voucher.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { error: `Cannot review voucher with status '${voucher.status}'. Only PENDING_REVIEW listings can be reviewed.` },
        { status: 400 }
      );
    }

    const newStatus = action === "APPROVE" ? "ACTIVE" : "REJECTED";
    const updated = await db.vouchers.update(voucherId, {
      status: newStatus,
      verificationNotes: reviewNotes || `Manually ${action.toLowerCase()}d by admin reviewer.`,
    });

    return NextResponse.json({
      success: true,
      message: `Voucher successfully ${action === "APPROVE" ? "approved and published to marketplace" : "rejected"}.`,
      voucher: updated,
    });
  } catch (error: any) {
    console.error("[Admin Reviews POST API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit review decision." },
      { status: 500 }
    );
  }
}
