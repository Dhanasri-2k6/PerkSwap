"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SmartUploadModal } from "@/components/SmartUploadModal";
import { AuthGuard } from "@/components/AuthGuard";

export default function SellPage() {
  return (
    <AuthGuard>
      <div className="space-y-6 max-w-xl mx-auto py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Marketplace</span>
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">List a Voucher</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Upload screenshot for automatic OCR extraction and recommended secondary market pricing.
          </p>
        </div>

        <SmartUploadModal />
      </div>
    </AuthGuard>
  );
}
