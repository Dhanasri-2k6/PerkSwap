import { NextResponse } from "next/server";
import { RegisterSchema } from "@/lib/validations";
import { hashPassword, signToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(req, "auth-register", 10, 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Too many registration attempts. Please wait ${rate.reset} seconds.` },
        { status: 429 }
      );
    }
    const body = await req.json();
    const validated = RegisterSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password } = validated.data;

    const existingUser = await db.users.findByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const starterCoins = 150.0;
    const user = await db.users.create({
      name,
      email,
      passwordHash,
      walletBalance: starterCoins,
      hasReceivedStarterGrant: true,
      trustScore: 88,
      verified: true,
    });

    try {
      await db.walletLedger.record({
        userId: user.id || user._id,
        type: "STARTER_GRANT",
        amount: starterCoins,
        balanceAfter: starterCoins,
        description: `Welcome starter grant: ${starterCoins} PerkSwap coins credited.`,
      });
    } catch (e) {
      console.error("[Register Starter Grant Ledger Error]:", e);
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
    console.error("Register Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
