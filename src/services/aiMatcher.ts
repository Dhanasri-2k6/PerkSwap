import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";

export interface MatchedVoucherRecommendation {
  voucher: {
    id: string;
    brand: string;
    category: string;
    faceValue: number;
    sellingPrice: number;
    minSpend: number;
    expiryDate: string;
    sellerName: string;
    sellerTrustScore: number;
  };
  cartValue: number;
  applicableDiscount: number;
  netSavings: number;
  roiPercentage: number;
  isEligible: boolean;
  recommendationReason: string;
}

export interface SmartMatchResponse {
  intent: {
    detectedBrand?: string;
    detectedCategory?: string;
    estimatedCartValue: number;
  };
  recommendations: MatchedVoucherRecommendation[];
  aiAdvice: string;
}

export async function matchCouponsWithAI(prompt: string): Promise<SmartMatchResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  let parsedIntent = {
    brand: "",
    category: "",
    cartValue: 1500,
  };

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });

      const parsePrompt = `
You are PerkSwap's Smart Deal Matcher AI.
The user wants to find the best coupon/voucher for their purchase.
User query: "${prompt}"

Extract:
1. "brand": Brand mentioned (e.g. "Myntra", "Swiggy", "Uber", "Zomato", "BookMyShow", "Amazon", "Apple"), or "" if generic.
2. "category": One of "FOOD", "SHOPPING", "TRAVEL", "ENTERTAINMENT", "TECH", or "" if unknown.
3. "cartValue": Number representing expected cart or bill amount in INR (default to 1000 if not stated).

Return strictly JSON:
{
  "brand": string,
  "category": string,
  "cartValue": number
}
`;
      const result = await model.generateContent(parsePrompt);
      const data = JSON.parse(result.response.text());
      parsedIntent = {
        brand: data.brand || "",
        category: data.category || "",
        cartValue: Number(data.cartValue) || 1000,
      };
    } catch (e) {
      console.warn("[aiMatcher] Gemini parsing failed, falling back to heuristic parsing:", e);
      parsedIntent = heuristicParsePrompt(prompt);
    }
  } else {
    parsedIntent = heuristicParsePrompt(prompt);
  }

  // Fetch active vouchers from DB (MongoDB or resilient memory fallback)
  const vouchers = await db.vouchers.findMany({
    status: "ACTIVE",
  });

  const cart = parsedIntent.cartValue;
  const brandQuery = parsedIntent.brand.toLowerCase();
  const catQuery = parsedIntent.category.toUpperCase();

  // Score and rank vouchers
  const scoredRecommendations: MatchedVoucherRecommendation[] = vouchers
    .map((v: any) => {
      const meetsMinSpend = cart >= v.minSpend;
      // Actual discount buyer gets on their cart
      const applicableDiscount = Math.min(v.faceValue, cart);
      // Net money saved after paying for voucher
      const netSavings = applicableDiscount - v.sellingPrice;
      const roi = v.sellingPrice > 0 ? Math.round((netSavings / v.sellingPrice) * 100) : 0;

      let reason = `Saves ₹${netSavings} net on your ₹${cart} order.`;
      if (!meetsMinSpend) {
        reason = `Requires min spend of ₹${v.minSpend} (Cart currently ₹${cart}).`;
      } else if (netSavings > 0) {
        reason = `Massive ${Math.round((v.faceValue / cart) * 100)}% discount with immediate ₹${netSavings} cash savings!`;
      }

      const expiryStr =
        v.expiryDate instanceof Date
          ? v.expiryDate.toISOString()
          : typeof v.expiryDate === "string"
          ? v.expiryDate
          : new Date(v.expiryDate || Date.now()).toISOString();

      return {
        voucher: {
          id: String(v.id || v._id),
          brand: v.brand,
          category: v.category,
          faceValue: Number(v.faceValue),
          sellingPrice: Number(v.sellingPrice),
          minSpend: Number(v.minSpend || 0),
          expiryDate: expiryStr,
          sellerName: v.seller?.name || "Verified Member",
          sellerTrustScore: Number(v.seller?.trustScore || 90),
        },
        cartValue: cart,
        applicableDiscount,
        netSavings,
        roiPercentage: roi,
        isEligible: meetsMinSpend,
        recommendationReason: reason,
      };
    })
    .filter((item) => {
      // If brand specified, match brand or category
      if (brandQuery && item.voucher.brand.toLowerCase().includes(brandQuery)) return true;
      if (catQuery && item.voucher.category === catQuery) return true;
      if (!brandQuery && !catQuery) return true;
      return false;
    })
    .sort((a, b) => {
      // Prioritize eligible and highest net savings
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      return b.netSavings - a.netSavings;
    });

  const topPick = scoredRecommendations[0];
  let aiAdvice = `We analyzed available peer-to-peer vouchers for your cart of ₹${cart}.`;

  if (topPick && topPick.netSavings > 0) {
    aiAdvice = `Top Pick: Buy the ₹${topPick.voucher.faceValue} ${topPick.voucher.brand} voucher for just ₹${topPick.voucher.sellingPrice}. After paying the seller via escrow, you pocket a net profit of ₹${topPick.netSavings} directly at checkout!`;
  } else if (topPick) {
    aiAdvice = `Found ${scoredRecommendations.length} available vouchers. Top match from verified seller with ${topPick.voucher.sellerTrustScore}% trust rating.`;
  }

  return {
    intent: {
      detectedBrand: parsedIntent.brand,
      detectedCategory: parsedIntent.category,
      estimatedCartValue: parsedIntent.cartValue,
    },
    recommendations: scoredRecommendations.slice(0, 5),
    aiAdvice,
  };
}

function heuristicParsePrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  let brand = "";
  let category = "";
  let cartValue = 1500;

  if (lower.includes("myntra") || lower.includes("zara") || lower.includes("clothes") || lower.includes("shoes")) {
    brand = lower.includes("myntra") ? "Myntra" : lower.includes("zara") ? "Zara" : "";
    category = "SHOPPING";
  } else if (lower.includes("swiggy") || lower.includes("zomato") || lower.includes("food") || lower.includes("dinner")) {
    brand = lower.includes("swiggy") ? "Swiggy" : lower.includes("zomato") ? "Zomato" : "";
    category = "FOOD";
  } else if (lower.includes("uber") || lower.includes("ola") || lower.includes("flight") || lower.includes("travel")) {
    brand = lower.includes("uber") ? "Uber" : "";
    category = "TRAVEL";
  } else if (lower.includes("bookmyshow") || lower.includes("movie") || lower.includes("ticket") || lower.includes("concert")) {
    brand = lower.includes("bookmyshow") ? "BookMyShow" : "";
    category = "ENTERTAINMENT";
  } else if (lower.includes("apple") || lower.includes("tech") || lower.includes("gadget")) {
    brand = "Apple";
    category = "TECH";
  }

  // Match numbers e.g. 2500, ₹1500, 500 rs
  const numMatch = lower.match(/(?:₹|rs\.?|inr)?\s*(\d{2,6})/);
  if (numMatch && numMatch[1]) {
    cartValue = parseInt(numMatch[1], 10);
  }

  return { brand, category, cartValue };
}
