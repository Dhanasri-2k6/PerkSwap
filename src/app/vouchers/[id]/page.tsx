"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Clock,
  Lock,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { SwapProposalModal } from "@/components/SwapProposalModal";
import { useApp } from "@/components/Providers";

export default function VoucherDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user, isAuthenticated, showToast, refreshUser, setShowTopupModal } = useApp();

  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    const fetchVoucher = async () => {
      try {
        const res = await fetch(`/api/vouchers/${id}`);
        if (res.ok) {
          const data = await res.json();
          setVoucher(data.voucher);
        }
      } catch (err) {
        console.error("Failed to load voucher:", err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchVoucher();
  }, [id]);

  const handleEscrowBuy = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/vouchers/${id}`);
      return;
    }

    if (user && user.walletBalance < voucher.sellingPrice) {
      showToast("Insufficient balance in your Escrow Wallet.");
      setShowTopupModal(true);
      return;
    }

    setPurchasing(true);
    try {
      const res = await fetch("/api/escrow/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucherId: voucher.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate escrow.");
      }

      showToast("Payment held in escrow! Code unmasked.");
      refreshUser();
      router.push(`/escrow/${data.transactionId}`);
    } catch (err: any) {
      showToast(err.message || "Purchase failed.");
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mb-2" />
        <span className="text-xs text-zinc-500">Loading voucher details...</span>
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-base font-semibold text-white mb-2">Voucher not found</h2>
        <Link href="/" className="text-xs text-zinc-400 hover:underline">
          Return to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Marketplace</span>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details */}
        <div className="md:col-span-2 space-y-4">
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[11px] uppercase font-bold tracking-wider text-zinc-400">
                  {voucher.brand} · {voucher.category}
                </span>
                {voucher.verificationStatus === "MERCHANT_VERIFIED" ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/50">
                    ✓ Merchant Verified
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                    🛡️ Unverified (Escrow Protected)
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">{voucher.title}</h1>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{voucher.description}</p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase text-zinc-400 block font-medium">Selling Price</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">₹{voucher.sellingPrice}</span>
                  <span className="text-xs text-zinc-500 line-through">₹{voucher.faceValue}</span>
                </div>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-800 text-zinc-200">
                {voucher.discountPercent}% OFF
              </span>
            </div>

            {/* Terms */}
            <div className="pt-2">
              <span className="text-xs font-semibold text-zinc-300 block mb-2">Terms & Conditions</span>
              <ul className="space-y-1.5 text-xs text-zinc-400">
                {voucher.termsAndConditions && voucher.termsAndConditions.length > 0 ? (
                  voucher.termsAndConditions.map((term: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                      <span>{term}</span>
                    </li>
                  ))
                ) : (
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                    <span>Valid on official brand checkout.</span>
                  </li>
                )}
                {voucher.minSpend > 0 && (
                  <li className="flex items-start gap-1.5 text-amber-300/90">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Requires minimum order of ₹{voucher.minSpend}.</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Escrow Buy / Swap Card */}
        <div className="space-y-4">
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-4">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>2-Hour Escrow Window</span>
            </div>

            <p className="text-xs text-zinc-400 leading-normal">
              Funds are safely locked. The encrypted code will unmask immediately for redemption.
            </p>

            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Total payable:</span>
              <span className="text-base font-bold text-white">₹{voucher.sellingPrice}</span>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleEscrowBuy}
                disabled={purchasing || voucher.status !== "ACTIVE"}
                className="w-full py-2.5 px-3 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {purchasing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {voucher.status === "ACTIVE"
                    ? `Buy with Escrow (₹${voucher.sellingPrice})`
                    : `Unavailable (${voucher.status})`}
                </span>
              </button>

              <button
                onClick={() => setShowSwapModal(true)}
                disabled={voucher.status !== "ACTIVE"}
                className="w-full py-2 px-3 rounded-md border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-zinc-400" />
                <span>Propose Direct Swap</span>
              </button>
            </div>
          </div>

          {/* Seller Trust Snippet */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 text-xs text-zinc-400 flex items-center justify-between">
            <div>
              <span className="text-zinc-200 font-medium block">{voucher.seller.name}</span>
              <span>{voucher.seller.completedTrades || 8} completed trades</span>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              {voucher.seller.trustScore}% Trust
            </span>
          </div>
        </div>
      </div>

      {showSwapModal && (
        <SwapProposalModal targetVoucher={voucher} onClose={() => setShowSwapModal(false)} />
      )}
    </div>
  );
}
