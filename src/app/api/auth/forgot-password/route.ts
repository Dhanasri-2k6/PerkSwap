import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(req, "auth-forgot-password", 5, 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Too many password reset attempts. Please wait ${rate.reset} seconds.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, newPassword, confirmPassword } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const user = await db.users.findByEmail(email.toLowerCase().trim());
    if (!user) {
      // Do not reveal user existence for timing attacks
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists, password has been reset successfully.",
      });
    }

    // Hash the new password with bcrypt (10 rounds)
    const newHash = await hashPassword(newPassword);

    await db.users.updatePassword(user.id, newHash);

    return NextResponse.json({
      success: true,
      message: "Password updated successfully! You can now log in with your new credentials.",
    });
  } catch (error: any) {
    console.error("[Forgot Password API Error]:", error);
    return NextResponse.json({ error: "Failed to reset password. Please try again." }, { status: 500 });
  }
}
