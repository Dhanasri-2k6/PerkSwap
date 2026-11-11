import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const body = await req.json();
    const { swapRequestId } = body;

    if (!swapRequestId) {
      return NextResponse.json({ error: "swapRequestId is required." }, { status: 400 });
    }

    const swap = await db.swaps.findById(swapRequestId);
    if (!swap) {
      return NextResponse.json({ error: "Swap proposal not found." }, { status: 404 });
    }

    // Only requester can cancel their own proposal
    if (String(swap.requesterId) !== String(auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: Only the requester can cancel this swap proposal." },
        { status: 403 }
      );
    }

    if (swap.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot cancel a swap proposal that is already ${swap.status}.` },
        { status: 400 }
      );
    }

    await db.swaps.update(swapRequestId, { status: "CANCELLED" });

    return NextResponse.json({
      success: true,
      message: "Swap proposal cancelled successfully.",
    });
  } catch (error: any) {
    console.error("[Swap Cancel Error]:", error);
    return NextResponse.json({ error: "Failed to cancel swap proposal." }, { status: 500 });
  }
}
