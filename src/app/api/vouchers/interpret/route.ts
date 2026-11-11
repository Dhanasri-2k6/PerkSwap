import { NextResponse } from "next/server";
import { runVoucherPipelineFromText } from "@/services/aiVision";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(req, "ocr-interpret", 30, 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Too many interpretation requests. Please try again in ${rate.reset} seconds.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Field 'text' (string) is required for voucher interpretation." },
        { status: 400 }
      );
    }

    // Pass ONLY the text to Gemini / secondary liquidation pipeline
    const pipelineResult = await runVoucherPipelineFromText(text);

    return NextResponse.json({
      success: true,
      extractedData: pipelineResult.extractedData,
      pricing: {
        recommendedPrice: pipelineResult.recommendedPrice,
        discountPercent: pipelineResult.suggestedDiscountPercent,
        formulaDetails: pipelineResult.pricingDetails.formulaDetails,
        calculationBasis: pipelineResult.pricingDetails.calculationBasis,
      },
      fraudEvaluation: pipelineResult.fraudEvaluation,
    });
  } catch (error: any) {
    console.error("[Voucher Interpret API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to interpret voucher text." },
      { status: 500 }
    );
  }
}
