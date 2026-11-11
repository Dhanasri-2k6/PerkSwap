import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
let apiKey = "";
for (const line of envFile.split("\n")) {
  if (line.startsWith("GEMINI_API_KEY=")) {
    apiKey = line.split("=")[1].trim().replace(/^["']|["']$/g, "");
  }
}

const sampleOcrText = `
Amazon Gift Card
Gift Card Value: Rs. 1000
Claim Code: ABCD-1234-XYZ
Valid Until: 31 December 2026
`;

async function testInterpretation() {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const prompt = `
You are an expert digital voucher, coupon, gift card, and event pass parser.
You are given OCR-extracted raw text from a voucher or coupon image.
Analyze the text carefully. Extract only the ground-truth information present in the text.
Do not hallucinate or invent codes or values that are not present.

OCR Extracted Text:
"""
${sampleOcrText}
"""

Rules:
1. "brand": Identify the brand or issuer name (e.g. Amazon, Swiggy, Myntra, Uber, Zomato, BookMyShow, etc.). If uncertain, return null.
2. "voucherCode": Look for promo codes, coupon codes, voucher codes, or claim codes (e.g., "ABCD-1234-XYZ", "SWIGGY50", "UBERPASS"). Reject generic words like "COUPON", "CODE", "OFFER", or "DISCOUNT". If uncertain, return null. Preserve exact case and characters.
3. "discountType": Classify strictly as "FLAT" (cash discount, gift card value, flat off) or "PERCENTAGE" (% discount).
4. "originalValue": Extract the numerical original face value or percentage number (e.g. 1000 for Rs 1000, 50 for 50%). If missing, return null.
5. "maxDiscount": If percentage discount, look for fine print like "up to Rs X" or "max discount Rs X". If none or flat, equal to originalValue.
6. "minSpend": Extract terms like "valid on orders above Rs X" or "min transaction Rs X". If none, return 0.
7. "expiryDate": Extract the explicit expiry date. Convert to ISO format (YYYY-MM-DD). If no year is specified, assume current year (2026). If absent, return null.
8. "category": Classify as "FOOD", "SHOPPING", "TRAVEL", "ENTERTAINMENT", "TECH", or "OTHER".
9. "offerSummary": A brief 3-6 word summary (e.g. "Flat Rs 1000 Gift Card" or "50% OFF up to Rs 150").
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

  const result = await model.generateContent(prompt);
  console.log("Parsed result:", JSON.stringify(JSON.parse(result.response.text()), null, 2));
}

testInterpretation();
