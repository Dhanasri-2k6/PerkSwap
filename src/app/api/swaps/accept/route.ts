import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to accept a swap." },
        { status: 401 }
      );
    }
    const requestedUserId = auth.userId;

    const body = await req.json();
    const { swapRequestId } = body;

    if (!swapRequestId) {
      return NextResponse.json({ error: "swapRequestId is required." }, { status: 400 });
    }

    const result = await db.swaps.executeSwap(swapRequestId, requestedUserId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      swapRequestId: result.swapId,
      revealedOfferedCode: result.revealedOfferedCode,
      revealedTargetCode: result.revealedTargetCode,
      receivedCode: result.receivedCode,
      receivedVoucher: {
        id: result.receivedVoucher.id || result.receivedVoucher._id,
        brand: result.receivedVoucher.brand,
        title: result.receivedVoucher.title,
        faceValue: result.receivedVoucher.faceValue,
      },
      message: "Swap accepted! Both voucher redemption codes have been unlocked and ownership exchanged.",
    });
  } catch (error: any) {
    console.error("[Swap Accept API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to accept swap proposal." },
      { status: 500 }
    );
  }
}
