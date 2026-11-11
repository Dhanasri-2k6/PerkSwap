"use client";

import React, { useState, useEffect } from "react";
import {
  Copy,
  Check,
  Clock,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useApp } from "./Providers";

interface EscrowTrackerProps {
  transaction: {
    id: string;
    amount: number;
    platformFee: number;
    sellerEarnings: number;
    status: "HELD_IN_ESCROW" | "RELEASED" | "REFUNDED" | "DISPUTED" | "CANCELLED";
    expiresAt: string;
    isBuyer?: boolean;
    isSeller?: boolean;
    voucher: {
      id: string;
      brand: string;
      faceValue: number;
      title: string;
      verificationStatus?: string;
    };
    unmaskedCode?: string;
    dispute?: {
      id?: string;
      _id?: string;
      reason: string;
      status: string;
      sellerResponse?: string;
      sellerResponseAt?: string;
      resolutionNotes?: string;
      resolvedAt?: string;
    } | null;
  };
  onRefresh?: () => void;
}

export function EscrowTracker({ transaction, onRefresh }: EscrowTrackerProps) {
  const { showToast, refreshUser } = useApp();
  const [showCode, setShowCode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [isReleasing, setIsReleasing] = useState(false);
  const [isDisputing, setIsDisputing] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [sellerResponseInput, setSellerResponseInput] = useState("");
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const diff = new Date(transaction.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Inspection window expired (Auto-release eligible)");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s remaining`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [transaction.expiresAt]);

  const copyCode = () => {
    if (!transaction.unmaskedCode) return;
    navigator.clipboard.writeText(transaction.unmaskedCode);
    setCopied(true);
    showToast("Voucher code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRelease = async () => {
    try {
      setIsReleasing(true);
      const res = await fetch("/api/escrow/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: transaction.id }),
      });
      if (res.ok) {
        showToast("Escrow released! Payout delivered to seller.");
        if (onRefresh) onRefresh();
        refreshUser();
      }
    } catch {
      showToast("Failed to release escrow.");
    } finally {
      setIsReleasing(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim() || disputeReason.length < 10) {
      showToast("Please describe the issue (at least 10 characters).");
      return;
    }
    try {
      setIsDisputing(true);
      const res = await fetch("/api/escrow/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transaction.id,
          reason: disputeReason,
        }),
      });
      if (res.ok) {
        showToast("Dispute opened. Funds frozen.");
        setShowDisputeModal(false);
        if (onRefresh) onRefresh();
      }
    } catch {
      showToast("Failed to file dispute.");
    } finally {
      setIsDisputing(false);
    }
  };

  const handleSellerResponse = async () => {
    if (!sellerResponseInput.trim()) {
      showToast("Please enter an explanation.");
      return;
    }
    try {
      setIsSubmittingResponse(true);
      const res = await fetch("/api/escrow/dispute/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transaction.id,
          sellerResponse: sellerResponseInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit response.");
      showToast("Seller response recorded.");
      setSellerResponseInput("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast(err.message || "Failed to submit response.");
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const handleMediateResolution = async (action: "RESOLVE_REFUND" | "RESOLVE_RELEASE") => {
    try {
      setIsResolving(true);
      const disputeId = transaction.dispute?.id || transaction.dispute?._id;
      const res = await fetch("/api/escrow/dispute/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          action,
          resolutionNotes: `Resolved via console as ${action}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve dispute.");
      showToast(data.message || "Dispute resolved.");
      if (onRefresh) onRefresh();
      refreshUser();
    } catch (err: any) {
      showToast(err.message || "Failed to resolve dispute.");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 4-Step Clean Progress */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Step 1</span>
          <span className="text-xs font-semibold text-zinc-200 block">Funds Held</span>
          <span className="text-[11px] text-zinc-400">₹{transaction.amount} locked</span>
        </div>

        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Step 2</span>
          <span className="text-xs font-semibold text-zinc-200 block">Code Unmasked</span>
          <span className="text-[11px] text-zinc-400">Decrypted</span>
        </div>

        <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-900">
          <span className="text-[10px] text-amber-400 uppercase font-bold block mb-1">Step 3</span>
          <span className="text-xs font-semibold text-white block">2h Inspection</span>
          <span className="text-[11px] text-amber-300">Active verification</span>
        </div>

        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Step 4</span>
          <span className="text-xs font-semibold text-zinc-200 block">
            {transaction.status === "RELEASED" ? "Completed" : "Payout"}
          </span>
          <span className="text-[11px] text-zinc-400">Release / Dispute</span>
        </div>
      </div>

      {/* Code Reveal Card */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] uppercase font-bold text-zinc-400 block">Voucher Code</span>
            <span className="text-sm font-semibold text-white">{transaction.voucher.brand}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCode(!showCode)}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title={showCode ? "Hide" : "Show"}
            >
              {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={copyCode}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-center text-lg font-bold tracking-widest text-emerald-400 select-all">
          {showCode ? transaction.unmaskedCode || "CODE-UNMASKED" : "••••-••••-••••"}
        </div>

        <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 text-amber-300">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeLeft}</span>
          </div>
          <span>Verify code at brand checkout.</span>
        </div>
      </div>

      {/* Resolution Actions & Status States */}
      {transaction.status === "HELD_IN_ESCROW" && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div>
            <span className="text-xs font-semibold text-white block">Verified and working?</span>
            <span className="text-[11px] text-zinc-400">Releases ₹{transaction.sellerEarnings} to seller.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDisputeModal(true)}
              className="px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
            >
              Dispute
            </button>
            <button
              onClick={handleRelease}
              disabled={isReleasing}
              className="px-4 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold transition-colors flex items-center gap-1"
            >
              {isReleasing && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>Confirm & Release</span>
            </button>
          </div>
        </div>
      )}

      {transaction.status === "DISPUTED" && (
        <div className="p-5 rounded-xl border border-amber-900/50 bg-amber-950/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                Escrow Funds Frozen · Under Dispute
              </span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-900/50 text-amber-200">
              Mediation Pending
            </span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">Dispute Reason</span>
            <p className="text-xs text-zinc-200">
              {transaction.dispute?.reason || "Buyer reported the code could not be redeemed."}
            </p>
          </div>

          {/* Policy Notice */}
          <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-3 rounded border border-zinc-800 leading-relaxed">
            <strong className="text-zinc-300">Policy Notice:</strong> Raising a dispute freezes the escrow countdown and holds funds safely. Submitting a report does <span className="text-amber-300 underline font-semibold">NOT grant an automatic instant refund</span>. The seller has an opportunity to respond with proof of validity, and an admin mediator will review evidence from both parties to decide a fair outcome.
          </div>

          {/* Seller Response Flow */}
          {transaction.dispute?.sellerResponse ? (
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">Seller Response</span>
              <p className="text-xs text-zinc-300">{transaction.dispute.sellerResponse}</p>
              {transaction.dispute.sellerResponseAt && (
                <span className="text-[10px] text-zinc-500 block">
                  Submitted: {new Date(transaction.dispute.sellerResponseAt).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-2 pt-1 border-t border-zinc-800/60">
              <span className="text-xs font-semibold text-zinc-300 block">Seller Explanation / Counter-Proof:</span>
              <textarea
                value={sellerResponseInput}
                onChange={(e) => setSellerResponseInput(e.target.value)}
                placeholder="Seller: Provide details, proof of purchase, or brand account status..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-zinc-600 h-20"
              />
              <button
                onClick={handleSellerResponse}
                disabled={isSubmittingResponse || !sellerResponseInput.trim()}
                className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium disabled:opacity-50"
              >
                {isSubmittingResponse ? "Submitting..." : "Submit Seller Explanation"}
              </button>
            </div>
          )}

          {/* Admin Mediation Controls */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Mediator Actions:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMediateResolution("RESOLVE_REFUND")}
                disabled={isResolving}
                className="px-3 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-medium"
              >
                Refund Buyer (₹{transaction.amount})
              </button>
              <button
                onClick={() => handleMediateResolution("RESOLVE_RELEASE")}
                disabled={isResolving}
                className="px-3 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-200 text-xs font-medium"
              >
                Release to Seller (₹{transaction.sellerEarnings})
              </button>
            </div>
          </div>
        </div>
      )}

      {transaction.status === "RELEASED" && (
        <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">Escrow Released Successfully</span>
          </div>
          <span>₹{transaction.sellerEarnings} transferred to seller wallet</span>
        </div>
      )}

      {transaction.status === "REFUNDED" && (
        <div className="p-4 rounded-xl border border-blue-900/50 bg-blue-950/20 flex items-center justify-between text-xs text-blue-300">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-400" />
            <span className="font-semibold">Escrow Refunded</span>
          </div>
          <span>₹{transaction.amount} returned to buyer wallet</span>
        </div>
      )}

      {transaction.status === "CANCELLED" && (
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 text-center">
          Escrow transaction was cancelled.
        </div>
      )}

      {/* Minimal Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-1">Open Dispute</h3>
            <p className="text-xs text-zinc-400 mb-3">
              Freezes escrow funds until verified by mediation.
            </p>

            <div className="text-[11px] text-zinc-400 bg-zinc-950 p-2.5 rounded border border-zinc-800 mb-3 leading-relaxed">
              <strong className="text-zinc-300">PerkSwap Policy:</strong> Raising a dispute freezes the funds in escrow. Submitting a report does not guarantee an immediate automatic refund; the seller and an admin mediator will review evidence.
            </div>

            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="State what went wrong (e.g., Code already redeemed at checkout)..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-zinc-600 h-24 mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDispute}
                disabled={isDisputing}
                className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
              >
                {isDisputing ? "Submitting..." : "Submit Dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
