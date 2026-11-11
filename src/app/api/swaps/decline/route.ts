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

    if (String(swap.requestedId) !== String(auth.userId) && String(swap.requesterId) !== String(auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: You are not a participant in this swap proposal." },
        { status: 403 }
      );
    }

    await db.swaps.update(swapRequestId, { status: "DECLINED" });

    return NextResponse.json({ success: true, message: "Swap proposal declined." });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to decline swap proposal." }, { status: 500 });
  }
}
