"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Wallet, Plus, LogOut, LogIn } from "lucide-react";
import { useApp } from "./Providers";

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout, setShowTopupModal } = useApp();

  const navLinks = [
    { href: "/", label: "Marketplace" },
    { href: "/swaps", label: "Swaps" },
    { href: "/dashboard", label: "Escrow Center" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand Logo & Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">
              Perk<span className="text-zinc-400">Swap</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "text-zinc-100 bg-zinc-800/80"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <>
              {/* Wallet Chip */}
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-md text-xs">
                <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-semibold text-zinc-200">₹{user.walletBalance.toFixed(0)}</span>
                <button
                  onClick={() => setShowTopupModal(true)}
                  className="text-[10px] text-zinc-400 hover:text-white px-1 font-medium"
                  title="Buy PerkSwap Coins (Razorpay Test Mode)"
                >
                  + Add
                </button>
              </div>

              {/* List Voucher Button */}
              <Link
                href="/sell"
                className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>List Voucher</span>
              </Link>

              {/* User profile & Logout */}
              <div className="flex items-center gap-2 pl-1">
                <Link
                  href="/profile"
                  className="text-xs text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors hidden sm:inline font-medium"
                  title="View Profile"
                >
                  {user.name.split(" ")[0]}
                </Link>
                <Link
                  href="/profile"
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800 transition-colors sm:hidden"
                  title="View Profile"
                >
                  <span className="text-xs font-bold text-zinc-300">P</span>
                </Link>
                <button
                  onClick={logout}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-md border border-zinc-800 hover:bg-zinc-900 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>

              <Link
                href="/register"
                className="text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-900 px-3 py-1.5 rounded-md transition-colors"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
