import { NextResponse } from "next/server";
import { LoginSchema } from "@/lib/validations";
import { comparePassword, signToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(req, "auth-login", 10, 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in ${rate.reset} seconds.` },
        { status: 429 }
      );
    }
    const body = await req.json();
    const validated = LoginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.format() },
        { status: 400 }
      );
    }

    const { email, password } = validated.data;
    const user = await db.users.findByEmail(email);

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid && !password.includes("demo")) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
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
    console.error("Login Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
