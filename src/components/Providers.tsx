"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { COIN_PACKAGES } from "@/lib/constants";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => {
      open: () => void;
      on: (event: string, callback: (response: any) => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  walletBalance: number;
  trustScore: number;
  verified: boolean;
  completedTrades: number;
  disputeCount?: number;
}

interface AppContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  quickDemoLogin: (role: "seller" | "buyer") => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  topupWallet: (packageId: string) => Promise<boolean>;
  showTopupModal: boolean;
  setShowTopupModal: (show: boolean) => void;
  activeToast: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType>({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  quickDemoLogin: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
  topupWallet: async () => false,
  showTopupModal: false,
  setShowTopupModal: () => {},
  activeToast: null,
  showToast: () => {},
});

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActiveToast(msg);
    setTimeout(() => {
      setActiveToast((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error("Failed to load user:", e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string = "demo123") => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      setUser(data.user);
      showToast(`Welcome back, ${data.user.name.split(" ")[0]}!`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error during login" };
    }
  };

  const register = async (name: string, email: string, password: string = "demo123") => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Registration failed" };
      }

      setUser(data.user);
      showToast(`Account created! Welcome, ${data.user.name.split(" ")[0]}.`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error during registration" };
    }
  };

  const quickDemoLogin = async (role: "seller" | "buyer") => {
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Demo login failed" };
      }

      setUser(data.user);
      showToast(`Logged in as ${role === "seller" ? "Aarav (Seller)" : "Priya (Buyer)"}!`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to switch to demo account" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setUser(null);
      showToast("Logged out successfully");
      router.push("/login");
    }
  };

  type PaymentFlowStep =
    | "IDLE"
    | "CREATING_ORDER"
    | "CHECKOUT_OPEN"
    | "VERIFYING"
    | "SUCCESS"
    | "PENDING"
    | "FAILED"
    | "CANCELLED";

  const [buyingPkgId, setBuyingPkgId] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<PaymentFlowStep>("IDLE");
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [verifiedPaymentInfo, setVerifiedPaymentInfo] = useState<{
    orderId: string;
    paymentId?: string | null;
    totalCoins?: number;
    status: string;
  } | null>(null);

  const isPaymentBusy =
    buyingPkgId !== null ||
    paymentStep === "CREATING_ORDER" ||
    paymentStep === "CHECKOUT_OPEN" ||
    paymentStep === "VERIFYING";

  const closeTopupModal = () => {
    if (paymentStep === "VERIFYING" || paymentStep === "CREATING_ORDER") return;
    setShowTopupModal(false);
    setPaymentStep("IDLE");
    setPaymentMessage(null);
    setVerifiedPaymentInfo(null);
    setBuyingPkgId(null);
  };

  const topupWallet = async (packageId: string): Promise<boolean> => {
    if (isPaymentBusy) return false;

    setBuyingPkgId(packageId);
    setPaymentStep("CREATING_ORDER");
    setPaymentMessage("Creating Razorpay Test Mode order...");
    setVerifiedPaymentInfo(null);

    try {
      const [scriptLoaded, orderRes] = await Promise.all([
        loadRazorpayScript(),
        fetch("/api/payments/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId }),
        }),
      ]);

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.orderId) {
        setPaymentStep("FAILED");
        setPaymentMessage(orderData.error || "Failed to initialize payment order.");
        setBuyingPkgId(null);
        return false;
      }

      if (!orderData.keyId || !String(orderData.keyId).startsWith("rzp_test_")) {
        setPaymentStep("FAILED");
        setPaymentMessage(
          "Blocked: Server did not return a valid Razorpay TEST key (rzp_test_*)."
        );
        setBuyingPkgId(null);
        return false;
      }

      if (!scriptLoaded || !window.Razorpay) {
        setPaymentStep("FAILED");
        setPaymentMessage(
          "Unable to load Razorpay Checkout script. Check your internet connection and retry."
        );
        setBuyingPkgId(null);
        return false;
      }

      return await new Promise<boolean>((resolve) => {
        let flowSettled = false;

        const rzp = new window.Razorpay!({
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "PerkSwap (TEST MODE)",
          description: `${orderData.package?.title || "Coin Pack"} — ${
            orderData.package?.totalCoins || ""
          } Coins (Test Environment)`,
          order_id: orderData.orderId,
          prefill: {
            name: user?.name || "",
            email: user?.email || "",
          },
          notes: {
            mode: "test",
            packageId,
          },
          theme: {
            color: "#10b981",
          },
          modal: {
            ondismiss: async () => {
              if (flowSettled) return;
              flowSettled = true;
              try {
                const statusRes = await fetch(
                  `/api/payments/status/${encodeURIComponent(orderData.orderId)}`
                );
                const statusData = statusRes.ok ? await statusRes.json() : null;
                if (statusData?.payment?.status === "captured" && statusData?.payment?.coinsCredited) {
                  await refreshUser();
                  window.dispatchEvent(
                    new CustomEvent("perkswap:payment-updated", {
                      detail: statusData.payment,
                    })
                  );
                  const credited =
                    statusData.payment.totalCoins || orderData.package?.totalCoins;
                  setPaymentStep("SUCCESS");
                  setVerifiedPaymentInfo({
                    orderId: orderData.orderId,
                    paymentId: statusData.payment.paymentId,
                    totalCoins: credited,
                    status: "captured",
                  });
                  setPaymentMessage(
                    `Payment confirmed! ${credited} coins were reconciled and added to your wallet.`
                  );
                  showToast(`Payment confirmed! +${credited} coins added.`);
                  setBuyingPkgId(null);
                  resolve(true);
                  return;
                }
              } catch {
                // ignore background status probe on cancel
              }
              setPaymentStep("CANCELLED");
              setPaymentMessage(
                "Payment checkout was closed before completion. No coins were credited."
              );
              setBuyingPkgId(null);
              resolve(false);
            },
          },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            if (flowSettled) return;
            flowSettled = true;

            setPaymentStep("VERIFYING");
            setPaymentMessage(
              "Verifying cryptographic signature and payment capture with server..."
            );

            try {
              const verifyRes = await fetch("/api/payments/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              const verifyData = await verifyRes.json();

              // Authoritative status confirmation from backend
              const statusRes = await fetch(
                `/api/payments/status/${encodeURIComponent(orderData.orderId)}`
              );
              const statusData = statusRes.ok ? await statusRes.json() : null;
              const finalStatus = statusData?.payment?.status || verifyData?.status;

              if (
                verifyRes.ok &&
                finalStatus === "captured" &&
                (statusData?.payment?.coinsCredited ?? true)
              ) {
                await refreshUser();
                window.dispatchEvent(
                  new CustomEvent("perkswap:payment-updated", {
                    detail: statusData?.payment || verifyData?.payment,
                  })
                );

                const credited =
                  statusData?.payment?.totalCoins ||
                  verifyData?.coinsCredited ||
                  orderData.package?.totalCoins;

                setPaymentStep("SUCCESS");
                setVerifiedPaymentInfo({
                  orderId: orderData.orderId,
                  paymentId: response.razorpay_payment_id,
                  totalCoins: credited,
                  status: "captured",
                });
                setPaymentMessage(
                  verifyData.message ||
                    `Verified & captured! ${credited} coins added to your wallet.`
                );
                showToast(`Verified! +${credited} coins added to your wallet.`);
                setBuyingPkgId(null);
                resolve(true);
                return;
              }

              if (verifyRes.status === 202 || finalStatus === "pending") {
                setPaymentStep("PENDING");
                setVerifiedPaymentInfo({
                  orderId: orderData.orderId,
                  paymentId: response.razorpay_payment_id,
                  status: "pending",
                });
                setPaymentMessage(
                  verifyData.message ||
                    "Payment is authorized and pending capture. Coins are NOT credited until capture is confirmed."
                );
                setBuyingPkgId(null);
                resolve(false);
                return;
              }

              setPaymentStep("FAILED");
              setPaymentMessage(
                verifyData.error || "Payment verification failed. No coins were credited."
              );
              setBuyingPkgId(null);
              resolve(false);
            } catch (verifyErr: any) {
              setPaymentStep("FAILED");
              setPaymentMessage(
                verifyErr?.message ||
                  "Network error verifying payment with server. Check your Wallet Ledger status."
              );
              setBuyingPkgId(null);
              resolve(false);
            }
          },
        });

        rzp.on("payment.failed", async (failResp: any) => {
          if (flowSettled) return;
          flowSettled = true;
          try {
            await fetch(`/api/payments/status/${encodeURIComponent(orderData.orderId)}`);
          } catch {
            // ignore
          }
          setPaymentStep("FAILED");
          setPaymentMessage(
            failResp?.error?.description ||
              "Test payment failed at Razorpay gateway. No coins were credited."
          );
          setBuyingPkgId(null);
          resolve(false);
        });

        setPaymentStep("CHECKOUT_OPEN");
        setPaymentMessage("Razorpay Test Checkout open. Complete payment in the popup window.");
        rzp.open();
      });
    } catch (err: any) {
      setPaymentStep("FAILED");
      setPaymentMessage(err?.message || "Network error starting Razorpay Checkout.");
      setBuyingPkgId(null);
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        quickDemoLogin,
        logout,
        refreshUser,
        topupWallet,
        showTopupModal,
        setShowTopupModal,
        activeToast,
        showToast,
      }}
    >
      {children}

      {/* Minimalist Toast */}
      {activeToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs font-medium px-4 py-3 rounded-lg shadow-xl backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{activeToast}</span>
        </div>
      )}

      {/* Razorpay Test Mode Coin Package Modal */}
      {showTopupModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Purchase PerkSwap Coins</h3>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  Test Mode
                </span>
              </div>
              <button
                onClick={closeTopupModal}
                disabled={paymentStep === "CREATING_ORDER" || paymentStep === "VERIFYING"}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-200/90">
              <strong>Razorpay Test Environment:</strong> Real money is never charged. Use
              Razorpay test cards/UPI to simulate coin purchases. Direct swaps cost 0 coins.
            </div>

            {/* Live Payment Lifecycle Status Banner */}
            {paymentStep !== "IDLE" && paymentMessage && (
              <div
                className={`mb-4 p-3 rounded-lg border text-xs space-y-1 ${
                  paymentStep === "SUCCESS"
                    ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-200"
                    : paymentStep === "FAILED"
                    ? "bg-rose-950/40 border-rose-700/60 text-rose-200"
                    : paymentStep === "PENDING" || paymentStep === "CANCELLED"
                    ? "bg-amber-950/40 border-amber-700/60 text-amber-200"
                    : "bg-zinc-950 border-zinc-700 text-zinc-200"
                }`}
              >
                <div className="font-semibold">
                  {paymentStep === "CREATING_ORDER" && "Creating Order..."}
                  {paymentStep === "CHECKOUT_OPEN" && "Awaiting Checkout Completion..."}
                  {paymentStep === "VERIFYING" && "Verifying Payment with Server..."}
                  {paymentStep === "SUCCESS" && "Payment Captured & Verified"}
                  {paymentStep === "PENDING" && "Payment Pending Capture"}
                  {paymentStep === "FAILED" && "Payment Failed"}
                  {paymentStep === "CANCELLED" && "Checkout Cancelled"}
                </div>
                <p className="text-[11px] opacity-90">{paymentMessage}</p>
                {verifiedPaymentInfo?.orderId && (
                  <p className="text-[10px] font-mono opacity-75 pt-0.5">
                    Order: {verifiedPaymentInfo.orderId}
                    {verifiedPaymentInfo.paymentId
                      ? ` · Payment: ${verifiedPaymentInfo.paymentId}`
                      : ""}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {COIN_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`p-3.5 rounded-xl border relative flex flex-col justify-between transition-all ${
                    pkg.popular
                      ? "border-emerald-600/70 bg-emerald-950/20"
                      : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                  }`}
                >
                  {pkg.popular && (
                    <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-zinc-950 uppercase tracking-wider">
                      Popular
                    </span>
                  )}
                  <div>
                    <h4 className="text-xs font-semibold text-white">{pkg.title}</h4>
                    <div className="flex items-baseline gap-1 my-1">
                      <span className="text-lg font-bold text-white">{pkg.coins}</span>
                      <span className="text-xs text-zinc-400">coins</span>
                      {pkg.bonusCoins ? (
                        <span className="text-[10px] text-emerald-400 font-semibold ml-1">
                          +{pkg.bonusCoins} bonus
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-zinc-400 mb-3">{pkg.description}</p>
                  </div>

                  <button
                    disabled={isPaymentBusy}
                    onClick={() => topupWallet(pkg.id)}
                    className={`w-full py-2 px-3 rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-1 ${
                      pkg.popular
                        ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                        : "bg-zinc-800 hover:bg-zinc-700 text-white"
                    } disabled:opacity-50`}
                  >
                    {buyingPkgId === pkg.id ? "Processing..." : `Pay Now · ₹${pkg.priceInr}`}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800">
              <span>Secured by Razorpay Standard Checkout (Test Mode)</span>
              <button
                onClick={closeTopupModal}
                disabled={paymentStep === "CREATING_ORDER" || paymentStep === "VERIFYING"}
                className="text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
              >
                {paymentStep === "SUCCESS" ? "Done" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
