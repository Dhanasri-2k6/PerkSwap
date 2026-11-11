import { NextResponse } from "next/server";
import { COIN_PACKAGES } from "@/lib/constants";

export async function GET() {
  return NextResponse.json({
    success: true,
    mode: "test",
    packages: COIN_PACKAGES,
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct wallet top-ups are disabled. Use /api/payments/create-order and complete Razorpay Test Mode Checkout.",
    },
    { status: 403 }
  );
}
