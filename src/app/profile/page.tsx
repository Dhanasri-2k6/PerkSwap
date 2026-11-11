"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  User as UserIcon,
  ShieldCheck,
  Wallet,
  Clock,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  Tag,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  ArrowLeftRight,
  ShoppingBag,
  History,
  CheckCheck,
  XCircle,
  CreditCard,
} from "lucide-react";
import { useApp } from "@/components/Providers";
import { AuthGuard } from "@/components/AuthGuard";

type ProfileTab =
  | "MY_COUPONS"
  | "MY_LISTINGS"
  | "SWAP_REQUESTS"
  | "PURCHASE_HISTORY"
  | "SWAP_HISTORY"
  | "WALLET_LEDGER"
  | "SETTINGS";

export default function ProfilePage() {
  const { user, refreshUser, setShowTopupModal, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<ProfileTab>("MY_COUPONS");
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);

  // Code reveal map: voucherId -> revealed plain code
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Swap action states
  const [processingSwapId, setProcessingSwapId] = useState<string | null>(null);
  const [swapFilter, setSwapFilter] = useState<string>("ALL");

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const fetchProfileDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/profile");
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        if (data.user?.name) {
          setNameInput(data.user.name);
        }
      }
    } catch (e) {
      console.error("Failed to load profile:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileDetails();

    const handlePaymentUpdate = () => {
      fetchProfileDetails();
      refreshUser();
    };
    window.addEventListener("perkswap:payment-updated", handlePaymentUpdate);
    return () => {
      window.removeEventListener("perkswap:payment-updated", handlePaymentUpdate);
    };
  }, []);

  const handleRevealCode = async (voucherId: string) => {
    if (revealedCodes[voucherId]) {
      // Toggle off
      setRevealedCodes((prev) => {
        const next = { ...prev };
        delete next[voucherId];
        return next;
      });
      return;
    }

    setRevealingId(voucherId);
    try {
      const res = await fetch(`/api/vouchers/${voucherId}/reveal`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reveal code.");

      setRevealedCodes((prev) => ({ ...prev, [voucherId]: data.code }));
      showToast("Voucher code revealed securely.");
    } catch (err: any) {
      showToast(err.message || "Failed to reveal voucher code.");
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    showToast("Voucher code copied to clipboard!");
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2500);
  };

  const handleSwapAction = async (swapId: string, action: "accept" | "decline" | "cancel") => {
    setProcessingSwapId(swapId);
    try {
      const endpoint =
        action === "accept"
          ? "/api/swaps/accept"
          : action === "cancel"
          ? "/api/swaps/cancel"
          : "/api/swaps/decline";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swapRequestId: swapId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} swap.`);

      showToast(data.message || `Swap ${action}ed successfully.`);
      fetchProfileDetails();
      refreshUser();
    } catch (err: any) {
      showToast(err.message || `Failed to ${action} swap.`);
    } finally {
      setProcessingSwapId(null);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update name.");

      showToast("Display name updated successfully!");
      setIsEditingName(false);
      refreshUser();
      fetchProfileDetails();
    } catch (err: any) {
      showToast(err.message || "Failed to update display name.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password.");

      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const myCoupons = profileData?.myCoupons || [];
  const myListings = profileData?.myListings || [];
  const swapRequests = profileData?.swapRequests?.all || [];
  const purchaseHistory = profileData?.purchaseHistory || [];
  const swapHistory = profileData?.swapHistory || [];
  const walletLedger = profileData?.walletLedger || [];
  const coinPayments = profileData?.coinPayments || [];

  const filteredSwaps = swapRequests.filter((s: any) => {
    if (swapFilter === "ALL") return true;
    return s.status === swapFilter;
  });

  return (
    <AuthGuard>
      <div className="space-y-6 max-w-5xl mx-auto py-6">
        {/* User Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl">
          {/* Identity */}
          <div className="md:col-span-2 flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shadow-inner">
              <UserIcon className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {profileData?.user?.name || user?.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {profileData?.user?.trustScore || user?.trustScore || 90}% Trust
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">
                {profileData?.user?.email || user?.email}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Completed Trades:{" "}
                <span className="text-zinc-300 font-semibold">
                  {profileData?.user?.completedTrades || 0}
                </span>
              </p>
            </div>
          </div>

          {/* Wallet Balance */}
          <div className="md:col-span-2 flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800/80">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 block">
                PerkSwap Coins
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-white">
                  {profileData?.user?.walletBalance !== undefined
                    ? Number(profileData.user.walletBalance).toFixed(0)
                    : Number(user?.walletBalance || 0).toFixed(0)}
                </span>
                <span className="text-xs text-zinc-400 font-medium">coins</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Used for purchases • Swaps cost 0 coins
              </p>
            </div>

            <button
              onClick={() => setShowTopupModal(true)}
              className="py-2 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors shadow-md flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Buy Coins</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          aria-label="Profile navigation tabs"
          className="w-full max-w-full flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 border-b border-zinc-800 text-xs"
        >
          <button
            type="button"
            onClick={() => setActiveTab("MY_COUPONS")}
            className={`px-3 lg:px-3.5 py-2.5 rounded-lg font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-2 ${
              activeTab === "MY_COUPONS"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>My Coupons</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-700/60 text-zinc-300">
              {myCoupons.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("MY_LISTINGS")}
            className={`px-3 lg:px-3.5 py-2.5 rounded-lg font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-2 ${
              activeTab === "MY_LISTINGS"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>My Listings</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-700/60 text-zinc-300">
              {myListings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SWAP_REQUESTS")}
            className={`px-3 lg:px-3.5 py-2.5 rounded-lg font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-2 ${
              activeTab === "SWAP_REQUESTS"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Swap Proposals</span>
            {swapRequests.filter((s: any) => s.status === "PENDING").length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                {swapRequests.filter((s: any) => s.status === "PENDING").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("PURCHASE_HISTORY")}
            className={`px-3 lg:px-3.5 py-2.5 rounded-lg font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-2 ${
              activeTab === "PURCHASE_HISTORY"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Purchases</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-700/60 text-zinc-300">
              {purchaseHistory.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SWAP_HISTORY")}
            className={`px-3 lg:px-3.5 py-2.5 rounded-lg font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-2 ${
              activeTab === "SWAP_HISTORY"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Completed Swaps</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-700/60 text-zinc-300">
              {swapHistory.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("WALLET_LEDGER")}
            className={`px-3 lg:px-3.5 py-2.5 rounded-lg font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-2 ${
              activeTab === "WALLET_LEDGER"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Wallet &amp; Payments</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-700/60 text-zinc-300">
              {coinPayments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SETTINGS")}
            className={`px-3 lg:px-3.5 py-2.5 rounded-lg font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-2 ${
              activeTab === "SETTINGS"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Security</span>
          </button>
        </div>

        {/* TAB 1: MY COUPONS (Acquired via Purchase or Direct Swap) */}
        {activeTab === "MY_COUPONS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">My Owned Coupons</h3>
                <p className="text-xs text-zinc-400">
                  Coupons you acquired through purchase or direct peer swap. Codes remain securely protected until you reveal them.
                </p>
              </div>
              <Link
                href="/"
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                Browse Marketplace →
              </Link>
            </div>

            {myCoupons.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
                <Tag className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-white">No Acquired Coupons Yet</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                  When you purchase a voucher or exchange one in a direct swap, it will appear here for you to reveal and redeem.
                </p>
                <Link
                  href="/"
                  className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs transition-colors inline-block"
                >
                  Explore Marketplace
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myCoupons.map((coupon: any) => {
                  const isRevealed = !!revealedCodes[coupon.id];
                  const plainCode = revealedCodes[coupon.id];
                  const isCopied = copiedId === coupon.id;

                  return (
                    <div
                      key={coupon.id}
                      className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-white uppercase tracking-wider block">
                              {coupon.brand}
                            </span>
                            <h4 className="text-sm font-semibold text-zinc-200 mt-0.5">
                              {coupon.title}
                            </h4>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              coupon.source === "SWAP"
                                ? "bg-purple-950/60 text-purple-300 border border-purple-800/40"
                                : "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
                            }`}
                          >
                            Acquired via {coupon.source}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/70 text-xs">
                          <div>
                            <span className="text-[10px] text-zinc-500 block">Value</span>
                            <span className="font-bold text-white">₹{coupon.faceValue}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block">Min Spend</span>
                            <span className="font-medium text-zinc-300">
                              {coupon.minSpend ? `₹${coupon.minSpend}` : "None"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block">Expires</span>
                            <span className="font-medium text-zinc-300">
                              {new Date(coupon.expiryDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Code Box & Actions */}
                      <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                              Claim Code
                            </span>
                            <span className="font-mono text-xs font-bold tracking-wider text-emerald-400 select-all">
                              {isRevealed ? plainCode : "••••••••••••"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleRevealCode(coupon.id)}
                              disabled={revealingId === coupon.id}
                              className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                              title={isRevealed ? "Hide code" : "Reveal protected code"}
                            >
                              {revealingId === coupon.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isRevealed ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {isRevealed && plainCode && (
                              <button
                                onClick={() => handleCopyCode(plainCode, coupon.id)}
                                className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                                title="Copy code"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {!isRevealed && (
                          <p className="text-[10px] text-zinc-500 text-center">
                            Click the eye icon to securely decrypt and reveal your claim code.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY LISTINGS (Uploaded Coupons) */}
        {activeTab === "MY_LISTINGS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">My Listed Vouchers</h3>
                <p className="text-xs text-zinc-400">
                  Vouchers you uploaded to PerkSwap. Track status across active, escrow, sold, or swapped.
                </p>
              </div>
              <Link
                href="/sell"
                className="py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>List New Voucher</span>
              </Link>
            </div>

            {myListings.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
                <ShoppingBag className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-white">No Listed Vouchers</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                  Upload unused gift cards or discount codes with instant OCR scan.
                </p>
                <Link
                  href="/sell"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors inline-block"
                >
                  Upload Your First Voucher
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myListings.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{item.brand}</span>
                        <span className="text-zinc-400">({item.title})</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1">
                        <span>Face Value: ₹{item.faceValue}</span>
                        <span>•</span>
                        <span>Price: ₹{item.sellingPrice}</span>
                        <span>•</span>
                        <span>Expires: {new Date(item.expiryDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.status === "ACTIVE"
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/40"
                            : item.status === "IN_ESCROW"
                            ? "bg-amber-950/60 text-amber-400 border border-amber-900/40"
                            : item.status === "SOLD"
                            ? "bg-blue-950/60 text-blue-400 border border-blue-900/40"
                            : item.status === "SWAPPED"
                            ? "bg-purple-950/60 text-purple-400 border border-purple-900/40"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {item.status}
                      </span>

                      <Link
                        href={`/vouchers/${item.id}`}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SWAP PROPOSALS (Incoming & Outgoing with Lifecycle Actions) */}
        {activeTab === "SWAP_REQUESTS" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">Swap Proposals</h3>
                <p className="text-xs text-zinc-400">
                  Review direct coupon exchange proposals. Zero coins involved. Codes unlock simultaneously upon acceptance.
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs">
                {["ALL", "PENDING", "ACCEPTED", "DECLINED"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSwapFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      swapFilter === f
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filteredSwaps.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
                <ArrowLeftRight className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-white">No Swap Proposals</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                  You have no swap proposals matching this filter.
                </p>
                <Link
                  href="/swaps"
                  className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs transition-colors inline-block"
                >
                  Open Swaps Portal
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSwaps.map((swap: any) => {
                  const currentUserId = profileData?.user?.id || user?.id;
                  const isIncoming = String(swap.requestedId) === String(currentUserId);
                  const partner = isIncoming ? swap.requester : swap.requested;

                  return (
                    <div
                      key={swap.id}
                      className="p-5 rounded-xl border border-zinc-800 bg-zinc-900 space-y-3.5 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-200 font-semibold">
                            {isIncoming
                              ? `Offer from ${partner?.name || "Member"}`
                              : `Proposal to ${partner?.name || "Member"}`}
                          </span>
                          {partner?.trustScore && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              {partner.trustScore}% Trust
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            swap.status === "ACCEPTED" || swap.status === "COMPLETED"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                              : swap.status === "DECLINED" || swap.status === "REJECTED"
                              ? "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                              : swap.status === "CANCELLED"
                              ? "bg-zinc-800 text-zinc-400"
                              : "bg-amber-950/40 text-amber-300 border border-amber-800/40"
                          }`}
                        >
                          {swap.status}
                        </span>
                      </div>

                      {/* Offered vs Target Voucher */}
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
                        <div className="sm:col-span-2">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">
                            {isIncoming ? "Offered to You" : "You Offered"}
                          </span>
                          <span className="font-semibold text-white block">
                            {swap.offeredVoucher?.brand || "Voucher"}
                          </span>
                          <span className="text-zinc-400 text-[11px]">
                            ₹{swap.offeredVoucher?.faceValue || 0} Face Value
                          </span>
                        </div>

                        <div className="sm:col-span-1 flex items-center justify-center">
                          <ArrowLeftRight className="w-4 h-4 text-zinc-500" />
                        </div>

                        <div className="sm:col-span-2 sm:text-right">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">
                            {isIncoming ? "Your Voucher" : "Requested Voucher"}
                          </span>
                          <span className="font-semibold text-white block">
                            {swap.targetVoucher?.brand || "Voucher"}
                          </span>
                          <span className="text-zinc-400 text-[11px]">
                            ₹{swap.targetVoucher?.faceValue || 0} Face Value
                          </span>
                        </div>
                      </div>

                      {/* Display Received Code directly if accepted */}
                      {(swap.status === "ACCEPTED" || swap.status === "COMPLETED") &&
                        swap.receivedCode && (
                          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                                Received Claim Code (Yours to redeem)
                              </span>
                              <span className="font-mono text-xs font-bold text-emerald-300 select-all">
                                {swap.receivedCode}
                              </span>
                            </div>
                            <button
                              onClick={() => handleCopyCode(swap.receivedCode, swap.id)}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1"
                            >
                              {copiedId === swap.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>Copy</span>
                            </button>
                          </div>
                        )}

                      {/* Action buttons */}
                      {swap.status === "PENDING" && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                          {isIncoming ? (
                            <>
                              <button
                                onClick={() => handleSwapAction(swap.id, "decline")}
                                disabled={processingSwapId === swap.id}
                                className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => handleSwapAction(swap.id, "accept")}
                                disabled={processingSwapId === swap.id}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-colors flex items-center gap-1.5"
                              >
                                {processingSwapId === swap.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Accept & Exchange Codes</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleSwapAction(swap.id, "cancel")}
                              disabled={processingSwapId === swap.id}
                              className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-rose-400 text-xs font-medium transition-colors"
                            >
                              Cancel Proposal
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PURCHASE HISTORY (Escrow transactions) */}
        {activeTab === "PURCHASE_HISTORY" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">Purchase & Escrow History</h3>
              <p className="text-xs text-zinc-400">
                Coupons purchased with coins. Escrow holds your payment securely until you inspect the claim code.
              </p>
            </div>

            {purchaseHistory.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
                <History className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-white">No Purchases Found</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                  You haven&apos;t purchased any coupons yet.
                </p>
                <Link
                  href="/"
                  className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs transition-colors inline-block"
                >
                  Shop Vouchers
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {purchaseHistory.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{tx.voucherBrand}</span>
                        <span className="text-zinc-400">({tx.voucherTitle})</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1">
                        <span>Paid: {tx.amount} coins</span>
                        <span>•</span>
                        <span>Face Value: ₹{tx.faceValue}</span>
                        <span>•</span>
                        <span>Date: {new Date(tx.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          tx.status === "RELEASED"
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/40"
                            : tx.status === "HELD_IN_ESCROW"
                            ? "bg-amber-950/60 text-amber-400 border border-amber-900/40"
                            : tx.status === "REFUNDED"
                            ? "bg-blue-950/60 text-blue-400 border border-blue-900/40"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {tx.status}
                      </span>

                      <Link
                        href={`/vouchers/${tx.voucherId}`}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                      >
                        Inspect Voucher
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SWAP HISTORY */}
        {activeTab === "SWAP_HISTORY" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">Completed Swap Trades</h3>
              <p className="text-xs text-zinc-400">
                Log of successfully exchanged vouchers. Your received code remains viewable below.
              </p>
            </div>

            {swapHistory.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
                <CheckCheck className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-white">No Completed Swaps Yet</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                  When you accept a swap request or another user accepts yours, the history will be archived here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {swapHistory.map((swap: any) => (
                  <div
                    key={swap.id}
                    className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-300 font-semibold">
                        Trade with {swap.otherUser?.name || "Peer"}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {swap.completedAt ? new Date(swap.completedAt).toLocaleDateString() : ""}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                          You Received
                        </span>
                        <span className="font-bold text-white">
                          {swap.receivedVoucher?.brand || "Voucher"} (₹
                          {swap.receivedVoucher?.faceValue || 0})
                        </span>
                      </div>

                      {swap.receivedCode && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-400 select-all">
                            {swap.receivedCode}
                          </span>
                          <button
                            onClick={() => handleCopyCode(swap.receivedCode, swap.id)}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                            title="Copy code"
                          >
                            {copiedId === swap.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: WALLET & RAZORPAY TEST MODE PAYMENTS */}
        {activeTab === "WALLET_LEDGER" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Wallet &amp; Coin Purchase History</h3>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                    Razorpay Test Mode
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  All coin purchases are processed exclusively in Razorpay Test Mode and credited only after verified gateway capture.
                </p>
              </div>
              <button
                onClick={() => setShowTopupModal(true)}
                className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Buy Coins (Test Mode)</span>
              </button>
            </div>

            {/* Razorpay Test Mode Orders */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Razorpay Checkout Orders ({coinPayments.length})</span>
              </div>

              {coinPayments.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
                  <CreditCard className="w-7 h-7 text-zinc-500 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-white">No Coin Orders Yet</h4>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                    Purchase a coin package using Razorpay Test Mode checkout to fund escrow purchases. Direct voucher swaps cost 0 coins.
                  </p>
                  <button
                    onClick={() => setShowTopupModal(true)}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Open Test Mode Checkout</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {coinPayments.map((payment: any) => (
                    <div
                      key={payment.id || payment.orderId}
                      className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white">{payment.packageTitle}</span>
                          <span className="text-zinc-400">
                            ₹{payment.amountInr} → +{payment.totalCoins} coins
                            {payment.bonusCoins ? ` (${payment.coins} + ${payment.bonusCoins} bonus)` : ""}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/50 border border-amber-800/40 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                            {payment.mode || "test"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 font-mono">
                          <span>Order: {payment.orderId}</span>
                          {payment.paymentId && (
                            <>
                              <span>•</span>
                              <span>Payment: {payment.paymentId}</span>
                            </>
                          )}
                          {payment.paymentMethod && (
                            <>
                              <span>•</span>
                              <span className="uppercase">{payment.paymentMethod}</span>
                            </>
                          )}
                        </div>
                        {payment.failureReason && payment.status === "failed" && (
                          <p className="text-[11px] text-rose-400 flex items-center gap-1">
                            <XCircle className="w-3 h-3 shrink-0" />
                            <span>{payment.failureReason}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            payment.status === "captured"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                              : payment.status === "pending"
                              ? "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                              : payment.status === "failed"
                              ? "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                              : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                          }`}
                        >
                          {payment.status}
                        </span>
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(payment.creditedAt || payment.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coin Wallet Ledger */}
            <div className="space-y-3 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <History className="w-3.5 h-3.5 text-zinc-400" />
                <span>Coin Wallet Ledger ({walletLedger.length})</span>
              </div>

              {walletLedger.length === 0 ? (
                <div className="p-6 text-center border border-zinc-800 rounded-xl bg-zinc-900/20 text-xs text-zinc-500">
                  No coin wallet ledger entries recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {walletLedger.map((entry: any) => {
                    const isCredit = Number(entry.amount) >= 0;
                    return (
                      <div
                        key={entry.id || entry._id}
                        className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase tracking-wider">
                              {entry.type}
                            </span>
                            <span className="text-zinc-200 font-medium break-words">{entry.description}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 mt-1">
                            <span>{new Date(entry.createdAt).toLocaleString()}</span>
                            {entry.referenceId && (
                              <>
                                <span>•</span>
                                <span className="font-mono break-all">Ref: {entry.referenceId}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span
                            className={`text-sm font-bold block ${
                              isCredit ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isCredit ? `+${entry.amount}` : entry.amount} coins
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            Balance: {entry.balanceAfter} coins
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: SETTINGS & PASSWORD */}
        {activeTab === "SETTINGS" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Edit Display Name */}
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
              <h3 className="text-sm font-bold text-white">Profile Name</h3>
              <form onSubmit={handleUpdateName} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={nameInput === profileData?.user?.name}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors disabled:opacity-50"
                >
                  Save Name
                </button>
              </form>
            </div>

            {/* Change Password */}
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
              <h3 className="text-sm font-bold text-white">Change Password</h3>

              {passwordError && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
