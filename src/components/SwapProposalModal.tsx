"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeftRight, Loader2, ArrowRight } from "lucide-react";
import { useApp } from "./Providers";
import { VoucherItem } from "./MarketplaceFeed";

interface SwapProposalModalProps {
  targetVoucher: VoucherItem;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SwapProposalModal({ targetVoucher, onClose, onSuccess }: SwapProposalModalProps) {
  const { user, showToast } = useApp();
  const [myVouchers, setMyVouchers] = useState<VoucherItem[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyVouchers = async () => {
      try {
        const res = await fetch("/api/vouchers");
        if (res.ok) {
          const data = await res.json();
          const currentUserId = user?.id || (user as any)?._id;
          const list = (data.vouchers || []).filter(
            (v: any) =>
              (String(v.sellerId) === String(currentUserId) ||
                String(v.seller?.id) === String(currentUserId)) &&
              v.id !== targetVoucher.id &&
              v.status === "ACTIVE"
          );
          setMyVouchers(list);
          if (list.length > 0) setSelectedVoucherId(list[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchMyVouchers();
    } else {
      setLoading(false);
    }
  }, [targetVoucher.id, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoucherId) {
      showToast("Select a voucher to trade.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/swaps/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeredVoucherId: selectedVoucherId,
          targetVoucherId: targetVoucher.id,
          notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit swap proposal.");
      }

      showToast("Swap proposal delivered to voucher owner!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || "Failed to propose swap.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-white">Propose Voucher Swap</h3>
          <button
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mb-2" />
            <span className="text-xs text-zinc-500">Checking your voucher inventory...</span>
          </div>
        ) : myVouchers.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">No Active Vouchers to Swap</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                You must have at least one active voucher listed in your account to propose a direct trade.
              </p>
            </div>
            <Link
              href="/sell"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 transition-colors"
            >
              <span>List a Voucher Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <>
            {/* Trade Comparison */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-zinc-950 border border-zinc-800 mb-4 text-xs">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold block">You Receive</span>
                <span className="font-semibold text-white block mt-0.5">{targetVoucher.brand}</span>
                <span className="text-zinc-400">₹{targetVoucher.faceValue} Value</span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold block">You Offer</span>
                {myVouchers.find((v) => v.id === selectedVoucherId) ? (
                  <>
                    <span className="font-semibold text-white block mt-0.5">
                      {myVouchers.find((v) => v.id === selectedVoucherId)?.brand}
                    </span>
                    <span className="text-zinc-400">
                      ₹{myVouchers.find((v) => v.id === selectedVoucherId)?.faceValue} Value
                    </span>
                  </>
                ) : (
                  <span className="text-zinc-500 mt-1 block">None</span>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Select Your Voucher to Offer
                </label>
                <select
                  value={selectedVoucherId}
                  onChange={(e) => setSelectedVoucherId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                >
                  {myVouchers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} · ₹{v.faceValue} Value
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Swapping my dining pass for your movie ticket"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Send Swap Offer</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
