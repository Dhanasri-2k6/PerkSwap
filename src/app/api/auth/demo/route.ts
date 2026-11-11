import { NextResponse } from "next/server";
import { signToken } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const role = body.role || "seller";

    const targetEmail = role === "buyer" ? "priya@perkswap.io" : "aarav@perkswap.io";
    let user = await db.users.findByEmail(targetEmail);

    if (!user) {
      user = await db.users.create({
        name: role === "buyer" ? "Priya Patel (Buyer)" : "Aarav Sharma (Seller)",
        email: targetEmail,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyzaaravhash",
        walletBalance: role === "buyer" ? 1800.0 : 2450.0,
        trustScore: role === "buyer" ? 92 : 96,
        verified: true,
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        walletBalance: user.walletBalance,
        trustScore: user.trustScore,
        verified: user.verified,
        completedTrades: user.completedTrades,
      },
      token,
    });

    response.cookies.set("perkswap_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Demo login error:", error);
    return NextResponse.json({ error: "Failed to login as demo user." }, { status: 500 });
  }
}
