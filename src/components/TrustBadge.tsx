import React from "react";
import { ShieldCheck, ShieldAlert, Award } from "lucide-react";

interface TrustBadgeProps {
  score: number;
  completedTrades?: number;
  verified?: boolean;
  size?: "sm" | "md" | "lg";
}

export function TrustBadge({ score, completedTrades, verified = true, size = "md" }: TrustBadgeProps) {
  let colorClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  let label = "Elite Trader";
  let Icon = ShieldCheck;

  if (score >= 90) {
    colorClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    label = "Verified Elite";
  } else if (score >= 75) {
    colorClass = "text-indigo-400 bg-indigo-500/10 border-indigo-500/30";
    label = "Trusted Trader";
  } else if (score >= 50) {
    colorClass = "text-amber-400 bg-amber-500/10 border-amber-500/30";
    label = "Standard Trader";
  } else {
    colorClass = "text-rose-400 bg-rose-500/10 border-rose-500/30";
    label = "Dispute Risk";
    Icon = ShieldAlert;
  }

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3.5 py-1.5 text-sm gap-2",
  };

  return (
    <div
      className={`inline-flex items-center font-medium rounded-full border ${colorClass} ${sizeClasses[size]}`}
      title={`PerkSwap Trust Score: ${score}/100 based on escrow releases and zero disputes`}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span className="font-semibold">{score}</span>
      <span className="opacity-80">· {label}</span>
      {completedTrades !== undefined && (
        <span className="opacity-60 text-[10px] ml-0.5">({completedTrades} trades)</span>
      )}
    </div>
  );
}
