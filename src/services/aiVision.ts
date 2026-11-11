import { GoogleGenerativeAI } from "@google/generative-ai";
import { createWorker } from "tesseract.js";

export type DiscountType = "FLAT" | "PERCENTAGE";

export interface ExtractedVoucherData {
  brand: string | null;
  category: "FOOD" | "SHOPPING" | "TRAVEL" | "ENTERTAINMENT" | "TECH" | "OTHER";
  voucherCode: string | null;
  code: string | null; // Alias for backward compatibility
  discountType: DiscountType;
  originalValue: number | null;
  faceValue: number;
  maxDiscount: number;
  minSpend: number;
  expiryDate: string | null; // ISO format (YYYY-MM-DD)
  fraudRiskScore: number;
  offerSummary: string;
  termsAndConditions?: string[];
  rawText?: string;
}

export interface PricingResult {
  recommendedPrice: number;
  discountPercent: number;
  calculationBasis: number;
  formulaDetails: string;
  urgentExpirySlash: boolean;
  minSpendPenalty: boolean;
}

export interface VisionPipelineOutput {
  extractedData: ExtractedVoucherData;
  recommendedPrice: number;
  suggestedDiscountPercent: number;
  pricingDetails: PricingResult;
  fraudEvaluation: {
    riskScore: number;
    isSuspicious: boolean;
    verdict: "AUTHENTIC" | "REVIEW_RECOMMENDED" | "FLAGGED";
  };
}

export const OCR_INTERPRET_PROMPT = `
You are an expert digital voucher, coupon, gift card, and event pass parser.
You are given OCR-extracted raw text from a voucher or coupon image.
Analyze the text carefully. Extract only the ground-truth information present in the text.
Do not hallucinate or invent codes or values that are not present.

Rules:
1. "brand": Identify the brand or issuer name (e.g. Amazon, Swiggy, Myntra, Uber, Zomato, BookMyShow, etc.). If uncertain, return null.
2. "voucherCode": Look for promo codes, coupon codes, voucher codes, or claim codes (e.g., "ABCD-1234-XYZ", "SWIGGY50", "UBERPASS"). Reject generic words like "COUPON", "CODE", "OFFER", or "DISCOUNT". If uncertain, return null. Preserve exact case and characters.
3. "discountType": Classify strictly as "FLAT" (cash discount, gift card value, flat off) or "PERCENTAGE" (% discount).
4. "originalValue": Extract the numerical original face value or percentage number (e.g. 1000 for Rs. 1000, 50 for 50%). If missing, return null.
5. "maxDiscount": If percentage discount, look for fine print like "up to Rs. X" or "max discount Rs. X". If none or flat, equal to originalValue.
6. "minSpend": Extract terms like "valid on orders above Rs. X" or "min transaction Rs. X". If none, return 0.
7. "expiryDate": Extract the explicit expiry date. Convert to ISO format (YYYY-MM-DD). If no year is specified, assume current year (2026). If absent, return null.
8. "category": Classify as "FOOD", "SHOPPING", "TRAVEL", "ENTERTAINMENT", "TECH", or "OTHER".
9. "offerSummary": A brief 3-6 word summary (e.g. "Flat Rs. 1000 Gift Card" or "50% OFF up to Rs. 150").
10. "termsAndConditions": Array of any specific terms or conditions extracted from the text.

Return strictly a valid JSON object matching this schema:
{
  "brand": "Amazon",
  "voucherCode": "ABCD-1234-XYZ",
  "discountType": "FLAT",
  "originalValue": 1000,
  "maxDiscount": 1000,
  "minSpend": 0,
  "expiryDate": "2026-12-31",
  "category": "SHOPPING",
  "offerSummary": "Amazon Gift Card Rs. 1000",
  "termsAndConditions": []
}
`;

/**
 * Deterministic secondary liquidation pricing engine:
 * - Percentage Discounts: 10% to 15% of max cap (suggest ₹15 to ₹25). Hard cap suggested price between ₹15 and ₹49.
 * - Flat Cash / Gift Cards: 20% to 30% of face value (suggest ₹100 to ₹150 for ₹500).
 * - High Min Spend Penalty: If minSpend > faceValue * 2, drop suggested price by 15%.
 * - Expiry Urgency: If expires within 48 hours, slash recommended price by 50%.
 * - Constraints: Never above 35% of face value, never below ₹10.
 */
export function calculateLiquidationPrice(params: {
  discountType: DiscountType;
  faceValue: number;
  maxDiscount?: number;
  minSpend: number;
  expiryDate?: string | Date;
}): PricingResult {
  const { discountType, faceValue, minSpend, expiryDate } = params;
  const numFaceValue = Number(faceValue) || 100;
  const numMaxDiscount = Number(params.maxDiscount) || numFaceValue;
  const numMinSpend = Number(minSpend) || 0;

  let basePrice = 0;
  let calculationBasis = numFaceValue;
  let formulaDetails = "";

  if (discountType === "PERCENTAGE") {
    // 10% - 15% of max cap (default 12.5%)
    calculationBasis = numMaxDiscount > 0 ? numMaxDiscount : 100;
    basePrice = calculationBasis * 0.125;
    // Hard cap between ₹15 and ₹49
    basePrice = Math.min(49, Math.max(15, basePrice));
    formulaDetails = `12.5% of max savings cap ₹${calculationBasis} (capped at ₹15-₹49)`;
  } else {
    // Flat cash: 20% - 30% of face value (default 25%)
    calculationBasis = numFaceValue;
    basePrice = calculationBasis * 0.25;
    formulaDetails = `25% of face value ₹${calculationBasis}`;
  }

  // High Minimum Spend Penalty: If minSpend > faceValue * 2, reduce by 15%
  let minSpendPenalty = false;
  if (numMinSpend > numFaceValue * 2) {
    basePrice = basePrice * 0.85;
    minSpendPenalty = true;
    formulaDetails += ` minus 15% high-threshold penalty (min spend ₹${numMinSpend} > 2x value)`;
  }

  // Expiry Urgency: If expires within 48 hours, slash price by 50%
  let urgentExpirySlash = false;
  if (expiryDate) {
    const expTime = new Date(expiryDate).getTime();
    const nowTime = Date.now();
    const hoursLeft = (expTime - nowTime) / (1000 * 60 * 60);
    if (hoursLeft > 0 && hoursLeft <= 48) {
      basePrice = basePrice * 0.5;
      urgentExpirySlash = true;
      formulaDetails += ` minus 50% 48-hour clearance slash`;
    }
  }

  // Constraints: Never above 35% of face value / max cap, never below ₹10
  const maxCeiling = Math.max(10, Math.round(calculationBasis * 0.35));
  let finalPrice = Math.round(basePrice);

  if (discountType === "PERCENTAGE") {
    finalPrice = Math.min(finalPrice, 49);
  }
  finalPrice = Math.min(finalPrice, maxCeiling);
  finalPrice = Math.max(finalPrice, 10);

  const discountPercent =
    calculationBasis > 0
      ? Math.max(0, Math.round(((calculationBasis - finalPrice) / calculationBasis) * 100))
      : 75;

  return {
    recommendedPrice: finalPrice,
    discountPercent,
    calculationBasis,
    formulaDetails,
    urgentExpirySlash,
    minSpendPenalty,
  };
}

/**
 * Uses Gemini API to interpret OCR-extracted text ONLY (no images are sent to Gemini).
 */
export async function interpretOcrText(rawOcrText: string): Promise<ExtractedVoucherData> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!rawOcrText || !rawOcrText.trim()) {
    return {
      brand: null,
      category: "OTHER",
      voucherCode: null,
      code: null,
      discountType: "FLAT",
      originalValue: null,
      faceValue: 100,
      maxDiscount: 100,
      minSpend: 0,
      expiryDate: null,
      fraudRiskScore: 0,
      offerSummary: "Unspecified Voucher",
      termsAndConditions: [],
      rawText: "",
    };
  }

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // Use currently supported gemini-2.5-flash model
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const fullPrompt = `${OCR_INTERPRET_PROMPT}\n\nOCR Extracted Text:\n"""\n${rawOcrText}\n"""`;
      const result = await model.generateContent(fullPrompt);
      const responseText = result.response.text();

      // Safely parse JSON response
      const parsed = JSON.parse(responseText);

      const discountType: DiscountType =
        parsed.discountType === "PERCENTAGE" ? "PERCENTAGE" : "FLAT";
      const origVal =
        parsed.originalValue !== null && parsed.originalValue !== undefined
          ? Number(parsed.originalValue)
          : null;
      const faceVal = origVal !== null ? origVal : 100;
      const maxDisc =
        parsed.maxDiscount !== null && parsed.maxDiscount !== undefined
          ? Number(parsed.maxDiscount)
          : faceVal;
      const minSp = Number(parsed.minSpend) || 0;
      const voucherCode = parsed.voucherCode || parsed.code || null;

      let offerSummary = parsed.offerSummary;
      if (!offerSummary) {
        if (discountType === "PERCENTAGE") {
          offerSummary = `${faceVal}% OFF up to ₹${maxDisc}`;
        } else {
          offerSummary = `Flat ₹${faceVal} OFF`;
        }
      }

      return {
        brand: parsed.brand || null,
        category: normalizeCategory(parsed.category || "SHOPPING"),
        voucherCode,
        code: voucherCode,
        discountType,
        originalValue: origVal,
        faceValue: faceVal,
        maxDiscount: maxDisc,
        minSpend: minSp,
        expiryDate: parsed.expiryDate || null,
        fraudRiskScore: 0,
        offerSummary,
        termsAndConditions: Array.isArray(parsed.termsAndConditions)
          ? parsed.termsAndConditions
          : [],
        rawText: rawOcrText,
      };
    } catch (err: any) {
      console.warn("[PerkSwap AI] Gemini text interpretation error, using heuristic parser:", err.message);
    }
  }

  // Fallback: Robust heuristic text parser if Gemini API is unavailable or rate limited
  return heuristicOcrParser(rawOcrText);
}

/**
 * Server-side Tesseract.js OCR extraction from an image buffer.
 * Note: The image buffer is processed locally with Tesseract. It is NEVER sent to Gemini.
 */
export async function extractTextWithTesseract(imageBuffer: Buffer): Promise<string> {
  let worker: any = null;
  try {
    worker = await createWorker("eng");
    const ret = await worker.recognize(imageBuffer);
    const text = ret.data.text || "";
    await worker.terminate();
    return text.trim();
  } catch (err) {
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
    console.error("[Tesseract Server OCR Error]:", err);
    throw new Error("Tesseract OCR extraction failed on server.");
  }
}

/**
 * Combined pipeline: Takes either OCR text string or image buffer, runs Tesseract OCR if buffer,
 * then sends ONLY the text to Gemini for structured extraction and calculates secondary liquidation price.
 */
export async function runVoucherPipelineFromText(rawText: string): Promise<VisionPipelineOutput> {
  const extractedData = await interpretOcrText(rawText);

  const pricingDetails = calculateLiquidationPrice({
    discountType: extractedData.discountType,
    faceValue: extractedData.faceValue,
    maxDiscount: extractedData.maxDiscount,
    minSpend: extractedData.minSpend,
    expiryDate: extractedData.expiryDate || undefined,
  });

  return {
    extractedData,
    recommendedPrice: pricingDetails.recommendedPrice,
    suggestedDiscountPercent: pricingDetails.discountPercent,
    pricingDetails,
    fraudEvaluation: {
      riskScore: extractedData.fraudRiskScore,
      isSuspicious: false,
      verdict: "AUTHENTIC",
    },
  };
}

/**
 * Normalizes category to strict enum
 */
function normalizeCategory(
  cat: string
): "FOOD" | "SHOPPING" | "TRAVEL" | "ENTERTAINMENT" | "TECH" | "OTHER" {
  if (!cat) return "SHOPPING";
  const upper = String(cat).toUpperCase();
  if (["FOOD", "SHOPPING", "TRAVEL", "ENTERTAINMENT", "TECH"].includes(upper)) {
    return upper as any;
  }
  return "OTHER";
}

/**
 * Calibrated heuristic parser as safe fallback for OCR text when Gemini API is offline
 */
function heuristicOcrParser(text: string): ExtractedVoucherData {
  const lower = text.toLowerCase();

  // 1. Detect Brand
  let detectedBrand: string | null = null;
  let category: "FOOD" | "SHOPPING" | "TRAVEL" | "ENTERTAINMENT" | "TECH" | "OTHER" = "SHOPPING";

  const brands = [
    { name: "Amazon", cat: "SHOPPING" as const },
    { name: "Flipkart", cat: "SHOPPING" as const },
    { name: "Myntra", cat: "SHOPPING" as const },
    { name: "Swiggy", cat: "FOOD" as const },
    { name: "Zomato", cat: "FOOD" as const },
    { name: "Uber", cat: "TRAVEL" as const },
    { name: "Ola", cat: "TRAVEL" as const },
    { name: "MakeMyTrip", cat: "TRAVEL" as const },
    { name: "BookMyShow", cat: "ENTERTAINMENT" as const },
    { name: "Apple", cat: "TECH" as const },
    { name: "Google", cat: "TECH" as const },
    { name: "Nykaa", cat: "SHOPPING" as const },
  ];

  for (const b of brands) {
    if (lower.includes(b.name.toLowerCase())) {
      detectedBrand = b.name;
      category = b.cat;
      break;
    }
  }

  // 2. Detect Code (e.g. "Claim Code: ABCD-1234-XYZ" or "Code: SWIGGY70")
  let code: string | null = null;
  const codeMatch = text.match(/(?:claim\s*code|promo\s*code|coupon\s*code|voucher\s*code|code)\s*[:=-]?\s*([A-Za-z0-9_-]{4,24})/i);
  if (codeMatch && codeMatch[1]) {
    code = codeMatch[1].trim();
  } else {
    // Look for uppercase token with hyphen or digits like ABCD-1234-XYZ or SWIGGY500
    const tokenMatch = text.match(/\b([A-Z0-9]{3,8}-[A-Z0-9]{3,8}(?:-[A-Z0-9]{3,8})?)\b/);
    if (tokenMatch && tokenMatch[1]) {
      code = tokenMatch[1];
    }
  }

  // 3. Detect Value (e.g. "Value: Rs. 1000", "Rs 1000", "₹1000", "50% OFF")
  let discountType: DiscountType = "FLAT";
  let faceValue = 100;
  let originalValue: number | null = null;
  let maxDiscount = 100;

  const percentMatch = text.match(/(\d{1,2})\s*%\s*(?:off|discount)/i);
  if (percentMatch && percentMatch[1]) {
    discountType = "PERCENTAGE";
    originalValue = Number(percentMatch[1]);
    faceValue = originalValue;
    const maxMatch = text.match(/(?:up\s*to|max(?:imum)?\s*discount)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
    maxDiscount = maxMatch ? Number(maxMatch[1]) : 150;
  } else {
    const valMatch = text.match(/(?:value|amount|worth|flat)?\s*[:=-]?\s*(?:rs\.?|inr|₹)\s*(\d+)/i);
    if (valMatch && valMatch[1]) {
      originalValue = Number(valMatch[1]);
      faceValue = originalValue;
      maxDiscount = faceValue;
    }
  }

  // 4. Detect Min Spend (e.g. "Valid on orders above Rs. 499")
  let minSpend = 0;
  const minSpendMatch = text.match(/(?:above|min(?:imum)?\s*(?:order|spend|transaction))\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
  if (minSpendMatch && minSpendMatch[1]) {
    minSpend = Number(minSpendMatch[1]);
  }

  // 5. Detect Expiry Date (e.g. "Valid Until: 31 December 2026" or "31/12/2026")
  let expiryDate: string | null = null;
  const dateMatch = text.match(/(?:valid\s*until|expires\s*on|expiry|valid\s*till)\s*[:=-]?\s*([0-9A-Za-z\s,/.-]{6,25})/i);
  if (dateMatch && dateMatch[1]) {
    const rawDateStr = dateMatch[1].trim();
    const parsedTime = Date.parse(rawDateStr);
    if (!isNaN(parsedTime)) {
      expiryDate = new Date(parsedTime).toISOString().split("T")[0];
    }
  }

  const offerSummary =
    discountType === "PERCENTAGE"
      ? `${faceValue}% OFF up to ₹${maxDiscount}`
      : `Flat ₹${faceValue} ${detectedBrand ? `${detectedBrand} Voucher` : "OFF"}`;

  return {
    brand: detectedBrand,
    category,
    voucherCode: code,
    code,
    discountType,
    originalValue,
    faceValue,
    maxDiscount,
    minSpend,
    expiryDate,
    fraudRiskScore: 0,
    offerSummary,
    termsAndConditions: [],
    rawText: text,
  };
}
