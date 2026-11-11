import React from "react";
import Link from "next/link";
import { ArrowLeft, Upload, ArrowLeftRight, CheckCircle2 } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "List or Browse Vouchers",
    description:
      "Upload unused coupons or digital passes with clear brand, discount value, terms, and expiry details, or explore active listings on the marketplace.",
    icon: Upload,
  },
  {
    number: "02",
    title: "Swap Directly or Buy with Coins",
    description:
      "Propose a 1-to-1 voucher exchange at no coin fee, or purchase a listed voucher using your PerkSwap coin balance.",
    icon: ArrowLeftRight,
  },
  {
    number: "03",
    title: "Verify & Redeem",
    description:
      "Accepted swaps unlock both codes simultaneously in each member's account. Coin purchases enter a timed inspection window in the Escrow Center before release.",
    icon: CheckCircle2,
  },
];

export default function HowItWorksPage() {
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
        <h1 className="text-2xl font-bold tracking-tight text-white">How It Works</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Three straightforward steps from unused coupon to real savings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-500">{step.number}</span>
                  <Icon className="w-4 h-4 text-zinc-300" />
                </div>
                <h2 className="text-sm font-semibold text-white">{step.title}</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Ready to get started?</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Explore current listings or list a voucher from your account.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/"
            className="px-4 py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold transition-colors"
          >
            Browse Marketplace
          </Link>
          <Link
            href="/swaps"
            className="px-4 py-2 rounded-md border border-zinc-800 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
          >
            Open Swaps
          </Link>
        </div>
      </div>
    </div>
  );
}
