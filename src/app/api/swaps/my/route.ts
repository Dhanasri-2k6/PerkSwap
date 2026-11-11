import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }
    const userId = auth.userId;

    const swaps = await db.swaps.findUserSwaps(userId);

    return NextResponse.json({
      success: true,
      swaps,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch user swaps." }, { status: 500 });
  }
}
