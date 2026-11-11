import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, ShieldCheck, Wallet } from "lucide-react";

export default function AboutPage() {
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
        <h1 className="text-2xl font-bold tracking-tight text-white">About PerkSwap</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Swap smarter. Save more. A peer-to-peer marketplace for unused brand vouchers and digital passes.
        </p>
      </div>

      <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
        <h2 className="text-sm font-semibold text-white">Built for Unused Digital Perks</h2>
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
          Millions of promotional coupons, gift vouchers, and event passes expire unused simply because the holder does not need that brand at the moment. PerkSwap connects members directly so unused perks find someone who will redeem them—through direct coupon-for-coupon swaps or discounted coin purchases.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
          <ArrowLeftRight className="w-4 h-4 text-zinc-300" />
          <h3 className="text-sm font-semibold text-white">Direct Coupon Swaps</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Exchange one voucher directly for another with zero coins required. Both claim codes unlock for each participant once the offer is accepted.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
          <ShieldCheck className="w-4 h-4 text-zinc-300" />
          <h3 className="text-sm font-semibold text-white">Inspection Window</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Coin purchases include a post-purchase inspection period inside the Escrow Center, letting buyers verify the voucher before seller settlement.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
          <Wallet className="w-4 h-4 text-zinc-300" />
          <h3 className="text-sm font-semibold text-white">Wallet &amp; Activity History</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Manage coin balances, track acquired coupons, review swap proposals, and view transaction records from one unified profile.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Link
          href="/how-it-works"
          className="px-4 py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold transition-colors"
        >
          See How It Works
        </Link>
        <Link
          href="/register"
          className="px-4 py-2 rounded-md border border-zinc-800 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
        >
          Create an Account
        </Link>
      </div>
    </div>
  );
}
