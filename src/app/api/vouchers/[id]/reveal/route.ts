import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptVoucher } from "@/lib/crypto";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const { id } = await params;
    const voucher = await db.vouchers.findById(id);

    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found." }, { status: 404 });
    }

    const callerId = String(auth.userId);
    let isAuthorized = false;

    // Check 1: Is caller current owner (either original uploader or recipient of swap/purchase)
    if (String(voucher.sellerId) === callerId) {
      isAuthorized = true;
    }

    // Check 2: Is caller the buyer in active escrow or completed sale
    if (!isAuthorized) {
      const tx = await db.transactions.findByVoucherId(id);
      if (tx && String(tx.buyerId) === callerId) {
        // Buyer is authorized during active escrow inspection or completed transaction
        if (tx.status === "HELD_IN_ESCROW" || tx.status === "RELEASED") {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to reveal this voucher's claim code." },
        { status: 403 }
      );
    }

    const plainCode = decryptVoucher(voucher);
    if (!plainCode) {
      return NextResponse.json(
        { error: "Failed to decrypt voucher code. Please contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      voucherId: id,
      brand: voucher.brand,
      code: plainCode,
    });
  } catch (error: any) {
    console.error("[Voucher Reveal API Error]:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
