import { NextResponse } from "next/server";
import { runVoucherPipelineFromText, extractTextWithTesseract } from "@/services/aiVision";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(req, "voucher-scan", 20, 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Too many scan requests. Please wait ${rate.reset} seconds.` },
        { status: 429 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let extractedText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No image file uploaded." }, { status: 400 });
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image file is too large. Maximum supported size is 10MB." },
          { status: 400 }
        );
      }

      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/jpg"];
      if (!validTypes.includes(file.type)) {
        return NextResponse.json(
          { error: "Unsupported image format. Please upload JPEG, PNG, WEBP, or BMP." },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract text locally on server using Tesseract.js
      extractedText = await extractTextWithTesseract(buffer);
    } else {
      const json = await req.json();

      // Check if client already extracted text via Tesseract.js
      if (json.text && typeof json.text === "string") {
        extractedText = json.text;
      } else if (json.image) {
        // Base64 image uploaded - run server-side Tesseract.js OCR
        const base64Data = json.image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        if (buffer.length > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: "Image payload exceeds 10MB limit." },
            { status: 400 }
          );
        }

        extractedText = await extractTextWithTesseract(buffer);
      } else {
        return NextResponse.json(
          { error: "Either 'text' (OCR extracted text) or 'file'/'image' is required." },
          { status: 400 }
        );
      }
    }

    // Send ONLY the extracted text to Gemini
    const pipelineResult = await runVoucherPipelineFromText(extractedText);

    return NextResponse.json({
      success: true,
      rawOcrText: extractedText,
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
    console.error("[Voucher Scan API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process voucher with OCR." },
      { status: 500 }
    );
  }
}
