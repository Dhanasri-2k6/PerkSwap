import React from "react";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck, ArrowLeftRight } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto py-4 space-y-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Marketplace</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white">Contact &amp; Support</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Reach our support team or manage order and swap questions directly in your account.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
          <div className="flex items-center gap-2 text-zinc-200">
            <Mail className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">General Inquiries</h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            For account assistance, listing feedback, or general questions about PerkSwap, contact us directly via email.
          </p>
          <a
            href="mailto:support@perkswap.io"
            className="inline-block text-xs font-medium text-zinc-100 hover:underline underline-offset-4 decoration-zinc-600"
          >
            support@perkswap.io
          </a>
        </div>

        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
          <div className="flex items-center gap-2 text-zinc-200">
            <ShieldCheck className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">Order &amp; Escrow Support</h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            If a purchased voucher code has an issue during the inspection window, open the order inside your Escrow Center to submit a dispute.
          </p>
          <div className="flex items-center gap-4 pt-1">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-zinc-100 hover:underline underline-offset-4 decoration-zinc-600"
            >
              Open Escrow Center
            </Link>
            <Link
              href="/swaps"
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>Manage Swaps</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
