import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const txs = await db.transactions.findByUserId(auth.userId);

    const enriched = await Promise.all(
      txs.map(async (tx: any) => {
        const voucher = await db.vouchers.findById(tx.voucherId);
        return {
          ...tx,
          id: tx.id || tx._id,
          voucherBrand: voucher?.brand || "Brand Voucher",
          title: voucher?.title || `₹${tx.amount} Voucher`,
          faceValue: voucher?.faceValue || tx.amount,
        };
      })
    );

    return NextResponse.json({
      success: true,
      transactions: enriched,
    });
  } catch (error: any) {
    console.error("[My Escrow API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch user escrow transactions." },
      { status: 500 }
    );
  }
}
