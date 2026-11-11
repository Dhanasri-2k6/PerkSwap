"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  ShieldCheck,
  Plus,
  ArrowRight,
  Clock,
  Loader2,
  Tag,
} from "lucide-react";
import { useApp } from "@/components/Providers";
import { AuthGuard } from "@/components/AuthGuard";

export default function DashboardPage() {
  const { user, setShowTopupModal } = useApp();
  const [activeTab, setActiveTab] = useState<"ESCROW" | "VOUCHERS">("ESCROW");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [myVouchers, setMyVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [txRes, vchRes] = await Promise.all([
          fetch("/api/escrow/my"),
          fetch("/api/vouchers"),
        ]);

        if (txRes.ok) {
          const txData = await txRes.json();
          setTransactions(txData.transactions || []);
        }

        if (vchRes.ok) {
          const vchData = await vchRes.json();
          const currentUserId = user?.id || (user as any)?._id;
          const userVchs = (vchData.vouchers || []).filter(
            (v: any) =>
              String(v.sellerId) === String(currentUserId) ||
              String(v.seller?.id) === String(currentUserId)
          );
          setMyVouchers(userVchs);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  return (
    <AuthGuard>
      <div className="space-y-8 max-w-4xl mx-auto py-4">
        {/* Profile & Wallet Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-semibold text-white">{user?.name}</h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">
                Trust Score: {user?.trustScore || 90}/100
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {user?.email} · {user?.completedTrades || 0} completed transactions
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase text-zinc-400 block font-medium">Escrow Wallet</span>
              <span className="text-lg font-bold text-white">₹{user?.walletBalance ? user.walletBalance.toFixed(2) : "0.00"}</span>
            </div>
            <button
              onClick={() => setShowTopupModal(true)}
              className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold transition-colors flex items-center gap-1"
              title="Buy PerkSwap Coins via Razorpay Test Mode"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buy Coins</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab("ESCROW")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "ESCROW"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Escrow Orders ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab("VOUCHERS")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "VOUCHERS"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            My Listed Vouchers ({myVouchers.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mb-2" />
            <span className="text-xs text-zinc-500">Loading your account ledger...</span>
          </div>
        ) : activeTab === "ESCROW" ? (
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="p-8 text-center border border-zinc-800 rounded-xl bg-zinc-900/20">
                <ShieldCheck className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-white mb-1">No Active Escrow Orders</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
                  When you buy a voucher or a buyer purchases your listing, the protected transaction appears here.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold"
                >
                  <span>Explore Marketplace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/30 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-zinc-300 uppercase">
                        {tx.voucherBrand}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          tx.status === "RELEASED"
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                            : tx.status === "DISPUTED"
                            ? "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                            : tx.status === "REFUNDED"
                            ? "bg-blue-950/60 text-blue-300 border border-blue-800/40"
                            : "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                        }`}
                      >
                        {tx.status === "HELD_IN_ESCROW" ? "In Escrow" : tx.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{tx.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                      <span>Amount: ₹{tx.amount}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-zinc-300">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Order #{tx.id.slice(0, 8)}</span>
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/escrow/${tx.id}`}
                    className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium transition-colors flex items-center gap-1 shrink-0"
                  >
                    <span>View Console</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {myVouchers.length === 0 ? (
              <div className="p-8 text-center border border-zinc-800 rounded-xl bg-zinc-900/20">
                <Tag className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-white mb-1">No Vouchers Listed</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
                  Turn your unused brand coupons and passes into cash or swap them with other members.
                </p>
                <Link
                  href="/sell"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>List a Voucher</span>
                </Link>
              </div>
            ) : (
              myVouchers.map((v) => (
                <div
                  key={v.id}
                  className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/30 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-white uppercase">{v.brand}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          v.status === "ACTIVE"
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                            : v.status === "PENDING_REVIEW"
                            ? "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-zinc-200">{v.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                      <span>Selling Price: ₹{v.sellingPrice}</span>
                      <span>·</span>
                      <span>Face Value: ₹{v.faceValue}</span>
                    </div>
                  </div>

                  <Link
                    href={`/vouchers/${v.id}`}
                    className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                  >
                    View Listing
                  </Link>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
