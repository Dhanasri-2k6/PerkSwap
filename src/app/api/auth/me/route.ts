import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const auth = getAuthUser(req);

    if (!auth) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const user = await db.users.findById(auth.userId);

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        walletBalance: user.walletBalance,
        trustScore: user.trustScore,
        verified: user.verified,
        completedTrades: user.completedTrades,
        disputeCount: user.disputeCount || 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to retrieve user session." }, { status: 500 });
  }
}
