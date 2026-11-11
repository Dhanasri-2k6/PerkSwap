import { NextResponse } from "next/server";
import { RecommendCouponsSchema } from "@/lib/validations";
import { matchCouponsWithAI } from "@/services/aiMatcher";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = RecommendCouponsSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.format() },
        { status: 400 }
      );
    }

    const { prompt } = validated.data;
    const matchResult = await matchCouponsWithAI(prompt);

    return NextResponse.json({
      success: true,
      ...matchResult,
    });
  } catch (error: any) {
    console.error("[Coupons Recommend API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process coupon recommendation." },
      { status: 500 }
    );
  }
}
