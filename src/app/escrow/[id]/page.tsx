"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { EscrowTracker } from "@/components/EscrowTracker";
import { AuthGuard } from "@/components/AuthGuard";

export default function EscrowDetailPage() {
  const params = useParams();
  const txId = params?.id as string;

  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchTransaction = async () => {
    try {
      const res = await fetch(`/api/escrow/${txId}`);
      if (res.ok) {
        const data = await res.json();
        setTransaction(data.transaction);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (txId) fetchTransaction();
  }, [txId]);

  return (
    <AuthGuard>
      <div className="space-y-6 max-w-3xl mx-auto py-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Escrow Order #{txId.slice(0, 8)}</span>
              </span>
            </div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Code Verification Console</h1>
          </div>

          <span className="text-xs font-medium px-2.5 py-1 rounded bg-zinc-800 text-zinc-300">
            Inspection Active
          </span>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mb-2" />
            <span className="text-xs text-zinc-500">Retrieving escrow ledger...</span>
          </div>
        ) : transaction ? (
          <EscrowTracker transaction={transaction} onRefresh={fetchTransaction} />
        ) : (
          <div className="p-8 text-center border border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-400">Transaction not found.</p>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
