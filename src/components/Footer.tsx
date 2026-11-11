"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-zinc-800/80 bg-zinc-950/90 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-7">
        {/* Top Row: Brand & Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 pb-5 border-b border-zinc-800/60">
          <div className="flex flex-col items-center sm:items-start gap-1 text-center sm:text-left">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <div className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center transition-colors group-hover:bg-zinc-700">
                <Zap className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">
                Perk<span className="text-zinc-400">Swap</span>
              </span>
            </Link>
            <p className="text-xs text-zinc-400">Swap smarter. Save more.</p>
          </div>

          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center justify-center sm:justify-end gap-6 text-xs font-medium"
          >
            {footerLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors duration-150 underline-offset-4 hover:underline decoration-zinc-700 ${
                    isActive
                      ? "text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Row: Dynamic Copyright */}
        <div className="pt-4 flex items-center justify-center sm:justify-start">
          <p
            suppressHydrationWarning
            className="text-xs text-zinc-500 text-center sm:text-left"
          >
            © {currentYear} PerkSwap. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
