"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";

export interface VoucherItem {
  id: string;
  brand: string;
  category: string;
  title: string;
  description: string;
  code: string;
  faceValue: number;
  sellingPrice: number;
  aiRecommendedPrice?: number;
  minSpend: number;
  expiryDate: string;
  status: string;
  verificationStatus?: "UNVERIFIED" | "MERCHANT_VERIFIED" | "FAILED";
  isSwapOnly: boolean;
  autoPriceDecay: boolean;
  priceDecayRate: number;
  fraudScore: number;
  discountPercent: number;
  seller: {
    id: string;
    name: string;
    trustScore: number;
    verified: boolean;
  };
}

export function MarketplaceFeed() {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const categories = [
    { id: "ALL", label: "All" },
    { id: "FOOD", label: "Food" },
    { id: "SHOPPING", label: "Shopping" },
    { id: "TRAVEL", label: "Travel" },
    { id: "ENTERTAINMENT", label: "Entertainment" },
    { id: "TECH", label: "Tech" },
  ];

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== "ALL") params.append("category", selectedCategory);

      const res = await fetch(`/api/vouchers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVouchers(data.vouchers || []);
      }
    } catch (e) {
      console.error("Failed to fetch vouchers:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, [selectedCategory]);

  const getTimeRemaining = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60));
    if (days > 0) return `${days}d left`;
    return `${hours}h left`;
  };

  const getKeyOffer = (v: VoucherItem) => {
    if (v.title && (v.title.includes("Flat") || v.title.includes("%"))) {
      return v.title.split(" - ")[0].split(" · ")[0];
    }
    return `Flat ₹${v.faceValue} OFF`;
  };

  return (
    <div className="space-y-6">
      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-zinc-800/60">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Clean Minimalist Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-44 rounded-lg bg-zinc-900/50 animate-pulse border border-zinc-800/60" />
          ))}
        </div>
      ) : vouchers.length === 0 ? (
        <div className="py-12 text-center border border-zinc-800 rounded-lg">
          <p className="text-zinc-400 text-xs">No active vouchers in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vouchers.map((voucher) => {
            const timeBadge = getTimeRemaining(voucher.expiryDate);
            const isUrgent = timeBadge.includes("h left");
            const keyOffer = getKeyOffer(voucher);

            return (
              <div
                key={voucher.id}
                className="group flex flex-col justify-between p-5 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700 transition-colors"
              >
                <div>
                  {/* Brand & Expiry Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold tracking-tight text-white uppercase">
                        {voucher.brand}
                      </span>
                      {voucher.verificationStatus === "MERCHANT_VERIFIED" ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/50">
                          ✓ Verified
                        </span>
                      ) : (
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
                          title="PerkSwap Escrow Protected: 2-hour window to inspect and verify before payout"
                        >
                          Unverified (Escrow Protected)
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${
                        isUrgent
                          ? "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{timeBadge}</span>
                    </span>
                  </div>

                  {/* Key Offer */}
                  <h3 className="text-base font-semibold text-zinc-100 mb-1 leading-snug">
                    {keyOffer}
                  </h3>

                  {voucher.minSpend > 0 && (
                    <p className="text-[11px] text-zinc-400 mb-4">
                      Min spend ₹{voucher.minSpend}
                    </p>
                  )}
                </div>

                {/* Price & Buy Button */}
                <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase font-medium">Price</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-white">₹{voucher.sellingPrice}</span>
                      <span className="text-xs text-zinc-500 line-through">₹{voucher.faceValue}</span>
                    </div>
                  </div>

                  <Link
                    href={`/vouchers/${voucher.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium px-3.5 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 transition-colors"
                  >
                    <span>Buy via Escrow</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
