import { NextResponse } from "next/server";
import { PriceDecayEngine } from "@/services/decayEngine";

export async function POST(req: Request) {
  try {
    const summary = await PriceDecayEngine.runDecayCycle();
    return NextResponse.json({
      success: true,
      summary,
      message: `Price decay cycle completed. Applied decay to ${summary.decayedCount} perishable vouchers.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to execute price decay." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
