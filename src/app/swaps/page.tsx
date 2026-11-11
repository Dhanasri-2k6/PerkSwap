"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Check,
  X,
  Unlock,
  Loader2,
  ArrowRight,
  Inbox,
  Send,
  Clock,
  Copy,
} from "lucide-react";
import { useApp } from "@/components/Providers";
import { AuthGuard } from "@/components/AuthGuard";

export default function SwapsPage() {
  const { user, showToast, refreshUser } = useApp();
  const [swaps, setSwaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"INCOMING" | "OUTGOING">("INCOMING");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [swappedResult, setSwappedResult] = useState<{
    swapId?: string;
    offeredCode?: string;
    targetCode?: string;
  } | null>(null);

  const fetchSwaps = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/swaps/my");
      if (res.ok) {
        const data = await res.json();
        setSwaps(data.swaps || []);
      } else {
        setSwaps([]);
      }
    } catch {
      setSwaps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSwaps();
    }
  }, [user]);

  const currentUserId = user?.id || (user as any)?._id;

  const incomingSwaps = swaps.filter(
    (s) => String(s.requestedId) === String(currentUserId)
  );
  const outgoingSwaps = swaps.filter(
    (s) => String(s.requesterId) === String(currentUserId)
  );

  const pendingIncomingCount = incomingSwaps.filter((s) => s.status === "PENDING").length;

  const handleAccept = async (swapId: string) => {
    setAcceptingId(swapId);
    try {
      const res = await fetch("/api/swaps/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swapRequestId: swapId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept swap.");

      showToast("Swap Accepted! Both codes are now unlocked.");
      setSwappedResult({
        swapId,
        offeredCode: data.revealedOfferedCode,
        targetCode: data.revealedTargetCode,
      });

      fetchSwaps();
      refreshUser();
    } catch (err: any) {
      showToast(err.message || "Failed to accept swap.");
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDecline = async (swapId: string) => {
    setDecliningId(swapId);
    try {
      const res = await fetch("/api/swaps/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swapRequestId: swapId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to decline swap.");
      }

      showToast("Swap proposal declined.");
      fetchSwaps();
    } catch (err: any) {
      showToast(err.message || "Failed to decline.");
    } finally {
      setDecliningId(null);
    }
  };

  const handleCancel = async (swapId: string) => {
    setCancellingId(swapId);
    try {
      const res = await fetch("/api/swaps/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swapRequestId: swapId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel swap.");
      }

      showToast("Swap proposal cancelled.");
      fetchSwaps();
    } catch (err: any) {
      showToast(err.message || "Failed to cancel proposal.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    showToast("Voucher code copied to clipboard!");
    setTimeout(() => {
      setCopiedCodeId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const displayedSwaps = activeTab === "INCOMING" ? incomingSwaps : outgoingSwaps;

  return (
    <AuthGuard>
      <div className="space-y-6 max-w-4xl mx-auto py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Voucher Swaps</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Direct peer-to-peer coupon trading. Zero coins involved. Both claim codes unlock simultaneously upon acceptance.
            </p>
          </div>

          <Link
            href="/"
            className="text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-md border border-zinc-800 hover:bg-zinc-900 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>Browse Marketplace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab("INCOMING")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "INCOMING"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Received Requests</span>
            {pendingIncomingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {pendingIncomingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("OUTGOING")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "OUTGOING"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Sent Proposals</span>
            <span className="text-[10px] text-zinc-500">({outgoingSwaps.length})</span>
          </button>
        </div>

        {/* Unlocked Code Notification Banner */}
        {swappedResult && (
          <div className="p-5 rounded-xl border border-emerald-900/50 bg-emerald-950/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Unlock className="w-4 h-4" />
              <span>Swap Completed Successfully! Both Codes Unlocked</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                  Received Code (Yours to redeem)
                </span>
                <div className="font-mono text-sm font-bold text-emerald-400 select-all">
                  {swappedResult.offeredCode}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                  Transferred Code (Delivered to peer)
                </span>
                <div className="font-mono text-sm font-bold text-zinc-300 select-all">
                  {swappedResult.targetCode}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Swaps List */}
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="h-36 rounded-xl bg-zinc-900/40 animate-pulse border border-zinc-800"
                />
              ))}
            </div>
          ) : displayedSwaps.length === 0 ? (
            <div className="py-12 px-4 text-center border border-zinc-800 rounded-xl bg-zinc-900/20">
              <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-400 mb-3">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-medium text-white mb-1">
                {activeTab === "INCOMING"
                  ? "No Incoming Swap Requests"
                  : "No Outgoing Proposals"}
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
                {activeTab === "INCOMING"
                  ? "When other members propose to trade for one of your listed vouchers, their offers will appear here for your review."
                  : "You have not proposed any voucher swaps yet. Explore the marketplace to find coupons you'd like to trade for."}
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 transition-colors"
              >
                <span>Find Vouchers to Swap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            displayedSwaps.map((swap) => {
              const isIncoming = String(swap.requestedId) === String(currentUserId);
              const partner = isIncoming ? swap.requester : swap.requested;
              const isAccepted = swap.status === "ACCEPTED" || swap.status === "COMPLETED";

              return (
                <div
                  key={swap.id}
                  className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3.5 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-200 font-semibold">
                        {isIncoming
                          ? `Proposal from ${partner?.name || "Member"}`
                          : `Proposal sent to ${partner?.name || "Member"}`}
                      </span>
                      {partner?.trustScore && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {partner.trustScore}% Trust
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded tracking-wide uppercase ${
                        isAccepted
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                          : swap.status === "DECLINED" || swap.status === "REJECTED"
                          ? "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                          : swap.status === "CANCELLED"
                          ? "bg-zinc-800 text-zinc-400"
                          : "bg-amber-950/40 text-amber-300 border border-amber-800/40"
                      }`}
                    >
                      {swap.status === "PENDING"
                        ? isIncoming
                          ? "Action Required"
                          : "Awaiting Response"
                        : swap.status}
                    </span>
                  </div>

                  {/* Asset Exchange Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center p-3.5 rounded-lg bg-zinc-950 border border-zinc-800/90 text-xs">
                    <div className="sm:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">
                        {isIncoming ? "They Offer" : "You Offered"}
                      </span>
                      <span className="font-semibold text-white block">
                        {swap.offeredVoucher?.brand || "Voucher"}
                      </span>
                      <span className="text-zinc-400 text-[11px]">
                        ₹{swap.offeredVoucher?.faceValue || 0} Face Value
                      </span>
                    </div>

                    <div className="sm:col-span-1 flex items-center justify-center">
                      <div className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                    </div>

                    <div className="sm:col-span-2 sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">
                        {isIncoming ? "For Your Voucher" : "In Exchange For"}
                      </span>
                      <span className="font-semibold text-white block">
                        {swap.targetVoucher?.brand || "Voucher"}
                      </span>
                      <span className="text-zinc-400 text-[11px]">
                        ₹{swap.targetVoucher?.faceValue || 0} Face Value
                      </span>
                    </div>
                  </div>

                  {swap.notes && (
                    <p className="text-xs text-zinc-400 italic bg-zinc-950/50 p-2.5 rounded border border-zinc-800/60">
                      &ldquo;{swap.notes}&rdquo;
                    </p>
                  )}

                  {/* Accepted Card: Display Received Code Directly */}
                  {isAccepted && swap.receivedCode && (
                    <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">
                          Received Claim Code (Decrypted & Verified)
                        </span>
                        <span className="font-mono text-sm font-bold text-emerald-300 select-all">
                          {swap.receivedCode}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(swap.receivedCode, swap.id)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors flex items-center gap-1.5"
                      >
                        {copiedCodeId === swap.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedCodeId === swap.id ? "Copied" : "Copy Code"}</span>
                      </button>
                    </div>
                  )}

                  {/* Action Buttons for Incoming Pending Requests */}
                  {isIncoming && swap.status === "PENDING" && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
                      <button
                        onClick={() => handleDecline(swap.id)}
                        disabled={decliningId === swap.id || acceptingId === swap.id}
                        className="px-3 py-1.5 rounded-md border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {decliningId === swap.id ? "Declining..." : "Decline"}
                      </button>

                      <button
                        onClick={() => handleAccept(swap.id)}
                        disabled={acceptingId === swap.id || decliningId === swap.id}
                        className="px-3.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {acceptingId === swap.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Accept & Unlock Codes</span>
                      </button>
                    </div>
                  )}

                  {/* Outgoing Pending Notice & Cancel Button */}
                  {!isIncoming && swap.status === "PENDING" && (
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/60">
                      <span className="flex items-center gap-1 text-amber-400/90">
                        <Clock className="w-3 h-3" />
                        <span>Awaiting approval from voucher owner</span>
                      </span>

                      <button
                        onClick={() => handleCancel(swap.id)}
                        disabled={cancellingId === swap.id}
                        className="px-2.5 py-1 rounded border border-zinc-800 hover:bg-zinc-800 text-rose-400 hover:text-rose-300 transition-colors text-xs"
                      >
                        {cancellingId === swap.id ? "Cancelling..." : "Cancel Proposal"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
