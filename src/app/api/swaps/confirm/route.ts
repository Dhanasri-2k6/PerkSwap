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
      return NextResponse.json({ error: "Swap not found." }, { status: 404 });
    }

    const callerId = String(auth.userId);
    if (String(swap.requesterId) !== callerId && String(swap.requestedId) !== callerId) {
      return NextResponse.json(
        { error: "Forbidden: You are not a participant in this swap." },
        { status: 403 }
      );
    }

    if (swap.status !== "ACCEPTED" && swap.status !== "CONFIRMATION_PENDING") {
      return NextResponse.json(
        { error: `Cannot confirm swap in ${swap.status} state.` },
        { status: 400 }
      );
    }

    const updated = await db.swaps.update(swapRequestId, {
      status: "COMPLETED",
      completedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Swap confirmed and marked as completed.",
      swap: updated,
    });
  } catch (error: any) {
    console.error("[Swap Confirm Error]:", error);
    return NextResponse.json({ error: "Failed to confirm swap." }, { status: 500 });
  }
}
