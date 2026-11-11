import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in to propose a swap." }, { status: 401 });
    }
    const requesterId = auth.userId;

    const body = await req.json();
    const { offeredVoucherId, targetVoucherId, notes } = body;

    if (!offeredVoucherId || !targetVoucherId) {
      return NextResponse.json({ error: "Both offeredVoucherId and targetVoucherId are required." }, { status: 400 });
    }

    if (offeredVoucherId === targetVoucherId) {
      return NextResponse.json({ error: "Cannot swap a voucher for itself." }, { status: 400 });
    }

    const [offered, target] = await Promise.all([
      db.vouchers.findById(offeredVoucherId),
      db.vouchers.findById(targetVoucherId),
    ]);

    if (!offered || !target) {
      return NextResponse.json({ error: "One or both vouchers not found." }, { status: 404 });
    }

    if (String(offered.sellerId) !== String(requesterId)) {
      return NextResponse.json({ error: "Forbidden: You can only offer vouchers that you own." }, { status: 403 });
    }

    if (String(target.sellerId) === String(requesterId)) {
      return NextResponse.json({ error: "You already own both vouchers. Cannot swap with yourself." }, { status: 400 });
    }

    const swap = await db.swaps.create({
      requesterId: String(requesterId),
      requestedId: String(target.sellerId),
      offeredVoucherId: String(offeredVoucherId),
      targetVoucherId: String(targetVoucherId),
      notes: notes || `Swap offer: ${offered.brand} (₹${offered.faceValue}) for ${target.brand} (₹${target.faceValue})`,
      status: "PENDING",
    });

    return NextResponse.json({
      success: true,
      swapRequestId: swap.id,
      message: `Swap proposal sent to ${target.seller?.name || "voucher owner"}. Both codes will be simultaneously revealed upon acceptance.`,
    });
  } catch (error: any) {
    console.error("[Swap Propose API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit swap proposal." }, { status: 500 });
  }
}
