import React from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-16rem)] flex flex-col items-center justify-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-2 group">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Zap className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            </div>
            <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Perk<span className="text-zinc-400">Swap</span>
            </span>
          </Link>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Secure peer-to-peer voucher escrow marketplace
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}
