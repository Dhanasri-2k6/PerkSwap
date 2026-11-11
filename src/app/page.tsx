"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { MarketplaceFeed } from "@/components/MarketplaceFeed";
import { useApp } from "@/components/Providers";

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useApp();
  const [searchPrompt, setSearchPrompt] = useState("");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-2" />
        <span className="text-xs text-zinc-500">Loading PerkSwap...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPrompt.trim()) return;

    setSearching(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/coupons/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: searchPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiResult(data.aiAdvice || "Search complete.");
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-10 py-4 max-w-5xl mx-auto">
      {/* Minimal Header */}
      <section className="space-y-4">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Secondary Marketplace for Digital Perks
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Trade and liquidate unused brand coupons, vouchers, and event tickets. All purchases held in 2-hour escrow until verified.
          </p>
        </div>

        {/* Minimal Search & AI Assistant */}
        <form onSubmit={handleAiSearch} className="max-w-xl flex items-center gap-2">
          <input
            type="text"
            value={searchPrompt}
            onChange={(e) => setSearchPrompt(e.target.value)}
            placeholder="Search deals (e.g., 'Swiggy food discount' or 'Myntra ₹2500 cart')..."
            className="flex-1 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            <span>{searching ? "Finding..." : "Find"}</span>
          </button>
        </form>

        {aiResult && (
          <div className="max-w-xl p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
            <span className="font-semibold text-white block mb-0.5">AI Recommendation:</span>
            {aiResult}
          </div>
        )}
      </section>

      {/* Clean Marketplace Feed */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Available Vouchers</h2>
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Escrow Guaranteed</span>
          </div>
        </div>

        <MarketplaceFeed />
      </section>
    </div>
  );
}
