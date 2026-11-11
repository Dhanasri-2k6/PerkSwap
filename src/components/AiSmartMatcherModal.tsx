"use client";

import React, { useState } from "react";
import { Sparkles, ArrowRight, CheckCircle2, TrendingUp, ShieldCheck, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { TrustBadge } from "./TrustBadge";

interface MatchedVoucher {
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

export function AiSmartMatcher() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    intent?: { detectedBrand?: string; detectedCategory?: string; estimatedCartValue: number };
    recommendations?: MatchedVoucher[];
    aiAdvice?: string;
  } | null>(null);

  const samplePrompts = [
    "I'm buying shoes on Myntra for ₹2500, find me the best coupon",
    "Ordering dinner on Swiggy for ₹650",
    "Going for weekend movie at BookMyShow for ₹800",
    "Need an Uber ride for ₹400",
  ];

  const handleSearch = async (queryText?: string) => {
    const q = queryText || prompt;
    if (!q || q.trim().length < 3) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/coupons/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (err) {
      console.error("Smart Matcher error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 via-slate-900/90 to-purple-950/40 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Gemini Multimodal Deal Intelligence
          </span>
          <span className="text-xs text-slate-400">Natural-Language Cart Arbitrage</span>
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-2">
          Tell AI what you&apos;re buying. We find the voucher that pockets the highest profit.
        </h2>
        <p className="text-sm md:text-base text-slate-300 mb-6 max-w-2xl">
          Enter your current shopping cart amount or destination. PerkSwap calculates maximum voucher discount minus escrow purchase cost to guarantee positive net savings.
        </p>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col sm:flex-row gap-3 mb-4"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., I'm buying sneakers on Myntra for ₹2500, find me the best coupon..."
              className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 text-white placeholder-slate-500 text-sm md:text-base rounded-xl px-4 py-3.5 pl-11 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
            <Sparkles className="w-5 h-5 text-indigo-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Arbitraging...</span>
              </>
            ) : (
              <>
                <span>Find Deal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Sample Pill Suggestions */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-slate-400">Try asking:</span>
          {samplePrompts.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPrompt(sample);
                handleSearch(sample);
              }}
              className="text-xs bg-slate-800/80 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg transition-colors"
            >
              &quot;{sample}&quot;
            </button>
          ))}
        </div>

        {/* Recommendations Result View */}
        {result && (
          <div className="mt-6 pt-6 border-t border-indigo-500/20 animate-fadeIn">
            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 mb-5">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-indigo-200">{result.aiAdvice}</p>
                  {result.intent && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>Detected Brand: <strong className="text-white">{result.intent.detectedBrand || "General"}</strong></span>
                      <span>•</span>
                      <span>Target Cart: <strong className="text-white">₹{result.intent.estimatedCartValue}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* List of Matched Vouchers */}
            <div className="space-y-3">
              {result.recommendations && result.recommendations.length > 0 ? (
                result.recommendations.map((item, idx) => {
                  const { voucher, cartValue, netSavings, roiPercentage, recommendationReason } = item;
                  return (
                    <div
                      key={voucher.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-lg shrink-0">
                          {idx === 0 ? "🥇" : "🎟️"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">{voucher.brand}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-medium">
                              ₹{voucher.faceValue} Face Value
                            </span>
                            <TrustBadge score={voucher.sellerTrustScore} size="sm" />
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{recommendationReason}</p>
                          <div className="flex items-center gap-3 text-xs mt-2 text-slate-300">
                            <span>Voucher Price: <strong>₹{voucher.sellingPrice}</strong></span>
                            <span>•</span>
                            <span>Min Spend: <strong>₹{voucher.minSpend}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Math & Action */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                        <div className="text-left sm:text-right">
                          <span className="text-[11px] text-slate-400 block uppercase tracking-wider font-semibold">
                            Net Cash Profit
                          </span>
                          <span className="text-xl font-extrabold text-emerald-400">
                            +₹{netSavings}
                          </span>
                          <span className="text-[10px] text-emerald-500 block font-medium">
                            ({roiPercentage}% ROI on ₹{voucher.sellingPrice} buy)
                          </span>
                        </div>

                        <Link
                          href={`/vouchers/${voucher.id}`}
                          className="mt-2 flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Buy via Escrow</span>
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-slate-400 text-sm">
                  No direct matching vouchers found for this brand in stock right now. Try another brand or check out active feed below!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
