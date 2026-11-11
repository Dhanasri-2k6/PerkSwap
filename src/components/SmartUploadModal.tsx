"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  Loader2,
  Lock,
  ArrowRight,
  RotateCcw,
  Check,
  AlertCircle,
  Sparkles,
  FileText,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import { useApp } from "./Providers";
import { DiscountType, calculateLiquidationPrice } from "@/services/aiVision";
import { createWorker } from "tesseract.js";

interface SmartUploadModalProps {
  onClose?: () => void;
}

const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function SmartUploadModal({ onClose }: SmartUploadModalProps) {
  const router = useRouter();
  const { showToast, refreshUser } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Steps:
  // 1: Upload Image & Review/Edit OCR Extracted Text
  // 2: Review & Edit Structured Details (from Gemini interpretation)
  const [step, setStep] = useState<1 | 2>(1);

  // Upload & OCR states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState<string>("");
  const [extractedOcrText, setExtractedOcrText] = useState<string>("");

  // AI Interpretation & Submission states
  const [interpreting, setInterpreting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    brand: "",
    category: "SHOPPING",
    title: "",
    description: "",
    code: "",
    discountType: "FLAT" as DiscountType,
    faceValue: 500,
    originalValue: 500,
    maxDiscount: 500,
    minSpend: 0,
    expiryDate: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
    fraudRiskScore: 0,
    sellingPrice: 125,
    aiRecommendedPrice: 125,
    pricingDetails: {
      formulaDetails: "25% liquidation of face value",
    },
    termsAndConditions: [] as string[],
    imageUrl: "",
    rawOcrText: "",
  });

  const recalculatePrice = (updates: Partial<typeof formData>) => {
    const updated = { ...formData, ...updates };
    const pricing = calculateLiquidationPrice({
      discountType: updated.discountType,
      faceValue: Number(updated.faceValue) || 100,
      maxDiscount: Number(updated.maxDiscount) || Number(updated.faceValue) || 100,
      minSpend: Number(updated.minSpend) || 0,
      expiryDate: updated.expiryDate,
    });

    setFormData({
      ...updated,
      sellingPrice: pricing.recommendedPrice,
      aiRecommendedPrice: pricing.recommendedPrice,
      pricingDetails: {
        formulaDetails: pricing.formulaDetails,
      },
    });
  };

  /**
   * Preprocess image on canvas to boost text and code contrast before OCR
   */
  const preprocessImageForOcr = async (file: File): Promise<string | File> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(file);
            return;
          }

          // Scale for optimal OCR resolution if too small
          let width = img.width;
          let height = img.height;
          if (width < 800) {
            const scale = 800 / width;
            width = 800;
            height = Math.round(height * scale);
          }

          canvas.width = width;
          canvas.height = height;

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Apply grayscale and contrast adjustment
          const imgData = ctx.getImageData(0, 0, width, height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            // High-contrast adjustment
            const contrastVal = gray > 130 ? Math.min(255, gray * 1.15) : Math.max(0, gray * 0.85);
            d[i] = contrastVal;
            d[i + 1] = contrastVal;
            d[i + 2] = contrastVal;
          }
          ctx.putImageData(imgData, 0, 0);

          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          URL.revokeObjectURL(url);
          resolve(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  };

  /**
   * File validation and OCR processing via Tesseract.js
   */
  const handleFileSelect = async (file: File) => {
    setError(null);

    // 1. Validate file type
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      setError("Unsupported file format. Please upload a PNG, JPEG, WEBP, or BMP voucher image.");
      return;
    }

    // 2. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError("Image is too large (exceeds 10MB). Please select a smaller voucher image.");
      return;
    }

    setImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);

    // 3. Perform Tesseract.js OCR
    setOcrLoading(true);
    setOcrProgress(5);
    setOcrStatus("Initializing Tesseract OCR engine...");

    let worker: any = null;
    try {
      // Preprocess image
      const preprocessed = await preprocessImageForOcr(file);

      // Create worker with progress logger
      worker = await createWorker("eng", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            const pct = Math.round((m.progress || 0) * 100);
            setOcrProgress(Math.min(99, Math.max(10, pct)));
            setOcrStatus(`Recognizing voucher text... ${pct}%`);
          } else if (m.status) {
            setOcrStatus(`OCR Engine: ${m.status}...`);
          }
        },
      });

      const ret = await worker.recognize(preprocessed);
      const text = ret.data?.text ? ret.data.text.trim() : "";

      await worker.terminate();
      worker = null;

      setOcrProgress(100);
      setExtractedOcrText(text);

      if (!text || text.length < 5) {
        setError("Low confidence or unreadable text detected. You can type or paste the voucher details below.");
      } else {
        showToast("Text extracted via Tesseract.js! Review below before AI analysis.");
      }
    } catch (ocrErr: any) {
      console.warn("[Tesseract Client OCR Warning]:", ocrErr?.message);
      // Fallback: If client worker fails (e.g., CSP or worker restriction), try server OCR
      try {
        setOcrStatus("Processing with server-assisted OCR fallback...");
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);

        const res = await fetch("/api/vouchers/scan", {
          method: "POST",
          body: formDataUpload,
        });

        if (res.ok) {
          const data = await res.json();
          setExtractedOcrText(data.rawOcrText || "");
          setOcrProgress(100);
        } else {
          throw new Error("OCR extraction failed");
        }
      } catch {
        setError("Could not automatically read text from this image. Please enter or paste the voucher text manually.");
      }
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {}
      }
      setOcrLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  /**
   * Sends ONLY the extracted text to Gemini API for structured interpretation
   */
  const handleInterpretText = async () => {
    if (!extractedOcrText.trim()) {
      setError("Please ensure there is extracted text or type the voucher details manually before analyzing.");
      return;
    }

    setError(null);
    setInterpreting(true);

    try {
      // Send ONLY the text string to the backend (NO image is sent to Gemini)
      const res = await fetch("/api/vouchers/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractedOcrText }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to interpret voucher text.");
      }

      const scanResult = await res.json();
      const ext = scanResult.extractedData;
      const pricing = scanResult.pricing;

      const brand = ext.brand || "Brand Voucher";
      const origVal = ext.originalValue !== null ? Number(ext.originalValue) : Number(ext.faceValue) || 100;
      const faceVal = Number(ext.faceValue) || origVal || 100;
      const maxDisc = Number(ext.maxDiscount) || faceVal;
      const discType: DiscountType = ext.discountType === "PERCENTAGE" ? "PERCENTAGE" : "FLAT";
      const minSp = Number(ext.minSpend) || 0;
      const recPrice = pricing.recommendedPrice || 25;

      let offerTitle = ext.offerSummary;
      if (!offerTitle) {
        offerTitle =
          discType === "PERCENTAGE"
            ? `${faceVal}% OFF up to ₹${maxDisc}`
            : `Flat ₹${faceVal} OFF`;
      }

      setFormData({
        brand,
        category: ext.category || "SHOPPING",
        title: offerTitle,
        description: `Verified coupon code. Applicable on orders above ₹${minSp}.`,
        code: ext.voucherCode || ext.code || "",
        discountType: discType,
        faceValue: faceVal,
        originalValue: origVal,
        maxDiscount: maxDisc,
        minSpend: minSp,
        expiryDate: ext.expiryDate
          ? ext.expiryDate.split("T")[0]
          : new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
        fraudRiskScore: ext.fraudRiskScore || 0,
        sellingPrice: recPrice,
        aiRecommendedPrice: recPrice,
        pricingDetails: {
          formulaDetails:
            pricing.formulaDetails || "Calculated via low-cost secondary liquidation formula",
        },
        termsAndConditions: ext.termsAndConditions || [],
        imageUrl: imagePreviewUrl || "https://images.unsplash.com/photo-1556742049-0a67e557224f?w=600&auto=format&fit=crop&q=60",
        rawOcrText: extractedOcrText,
      });

      // Move to Step 2 for editable review
      setStep(2);
      showToast("Gemini interpreted OCR text into structured fields! Review details below.");
    } catch (err: any) {
      setError(err.message || "Failed to analyze text. You can still fill the form manually.");
      setStep(2);
    } finally {
      setInterpreting(false);
    }
  };

  /**
   * Final submission to MongoDB with AES-256-GCM encrypted voucher code
   */
  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/vouchers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: formData.brand || "Brand Perk",
          category: formData.category,
          title: formData.title || `${formData.brand} Offer`,
          description: formData.description,
          code: formData.code || "SECURE-CODE",
          discountType: formData.discountType,
          faceValue: Number(formData.faceValue),
          originalValue: Number(formData.originalValue || formData.faceValue),
          maxDiscount: Number(formData.maxDiscount),
          sellingPrice: Number(formData.sellingPrice),
          minSpend: Number(formData.minSpend),
          expiryDate: formData.expiryDate,
          fraudRiskScore: formData.fraudRiskScore,
          rawOcrText: formData.rawOcrText,
          termsAndConditions: formData.termsAndConditions,
          imageUrl: formData.imageUrl,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create listing.");
      }

      showToast("Voucher listed successfully in MongoDB with AES-256 encryption!");
      refreshUser();
      if (onClose) onClose();
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to submit voucher listing.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-xl p-6 sm:p-8 shadow-sm">
      {/* Wizard Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-800">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block">
            Step {step} of 2
          </span>
          <h2 className="text-lg font-semibold text-white">
            {step === 1 ? "OCR Voucher Extraction" : "Review & Adjust Details"}
          </h2>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 1: Upload, Tesseract OCR & Text Review               */}
      {/* ======================================================== */}
      {step === 1 && (
        <div className="space-y-5">
          {!imagePreviewUrl ? (
            /* Upload Dropzone */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl p-8 sm:p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer bg-zinc-950/40"
            >
              <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300 mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>

              <h3 className="text-sm font-medium text-white mb-1">
                Drop voucher screenshot or click to browse
              </h3>
              <p className="text-xs text-zinc-400 max-w-xs mb-4">
                Upload Amazon gift card, Swiggy/Zomato reward, or brand coupon (PNG, JPEG, WEBP, up to 10MB).
              </p>

              <button
                type="button"
                className="px-4 py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold transition-colors"
              >
                Choose Image
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp, image/bmp"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            /* Image Preview & Replace Option */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded border border-zinc-700 bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreviewUrl} alt="Voucher Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-medium text-white truncate">
                      {imageFile?.name || "Uploaded Voucher Image"}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : "Preview available"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Replace Image</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/bmp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* OCR Progress Indicator */}
              {ocrLoading && (
                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      {ocrStatus || "Tesseract OCR is processing..."}
                    </span>
                    <span className="text-emerald-400 font-bold">{ocrProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Running local Tesseract.js OCR. The image stays secure on your device.
                  </p>
                </div>
              )}

              {/* Extracted OCR Text Review & Edit Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    <span>OCR Extracted Text (Review & Edit)</span>
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    {extractedOcrText.length} characters
                  </span>
                </div>

                <textarea
                  rows={5}
                  value={extractedOcrText}
                  onChange={(e) => setExtractedOcrText(e.target.value)}
                  placeholder="Extracted text from Tesseract.js will appear here. You can edit claim codes or add lines before sending to Gemini..."
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 leading-relaxed resize-y"
                />
                <p className="text-[11px] text-zinc-500">
                  Tip: Verify that the claim code or promo numbers are exact before analyzing with Gemini.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      rawOcrText: extractedOcrText,
                    });
                    setStep(2);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Skip to manual form &rarr;
                </button>

                <button
                  type="button"
                  onClick={handleInterpretText}
                  disabled={interpreting || ocrLoading || !extractedOcrText.trim()}
                  className="px-4 py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {interpreting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Gemini is Interpreting Text...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
                      <span>Interpret with Gemini AI</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {!imagePreviewUrl && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Or enter details manually without image &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 2: Clean, Editable Structured Details Form           */}
      {/* ======================================================== */}
      {step === 2 && (
        <form onSubmit={handleSubmitListing} className="space-y-4">
          {/* Secondary Liquidation Price Banner */}
          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                  Secondary Liquidation Price
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-emerald-400">₹{formData.aiRecommendedPrice}</span>
                <span className="text-[11px] text-zinc-400">({formData.pricingDetails.formulaDetails})</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, sellingPrice: formData.aiRecommendedPrice })}
              className="text-[11px] text-zinc-300 hover:text-white px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Apply Price
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Brand</label>
              <input
                type="text"
                required
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="e.g. Amazon, Swiggy, Myntra, Uber"
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Highlight / Offer</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Flat ₹1000 Gift Card"
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Discount Type</label>
              <select
                value={formData.discountType}
                onChange={(e) => recalculatePrice({ discountType: e.target.value as DiscountType })}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-600"
              >
                <option value="FLAT">Flat Cash / Gift Card</option>
                <option value="PERCENTAGE">Percentage Discount (%)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-600"
              >
                <option value="SHOPPING">Shopping & Retail</option>
                <option value="FOOD">Food & Dining</option>
                <option value="TRAVEL">Travel & Rides</option>
                <option value="ENTERTAINMENT">Entertainment & Tickets</option>
                <option value="TECH">Tech & Apps</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {formData.discountType === "PERCENTAGE" ? "Discount Percentage (%)" : "Original Value / Face Value (₹)"}
              </label>
              <input
                type="number"
                required
                value={formData.faceValue}
                onChange={(e) => recalculatePrice({ faceValue: Number(e.target.value), originalValue: Number(e.target.value) })}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            {formData.discountType === "PERCENTAGE" && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Max Savings Cap (₹)</label>
                <input
                  type="number"
                  value={formData.maxDiscount}
                  onChange={(e) => recalculatePrice({ maxDiscount: Number(e.target.value) })}
                  placeholder="e.g. 100 for 'up to ₹100'"
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Min Order Spend (₹)</label>
              <input
                type="number"
                value={formData.minSpend}
                onChange={(e) => recalculatePrice({ minSpend: Number(e.target.value) })}
                placeholder="0 if none"
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Voucher / Claim Code (Encrypted with AES-256)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. ABCD-1234-XYZ"
                  className="w-full px-3 py-1.5 pl-7 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-emerald-400 focus:outline-none focus:border-zinc-600"
                />
                <Lock className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Expiry Date</label>
              <input
                type="date"
                required
                value={formData.expiryDate}
                onChange={(e) => recalculatePrice({ expiryDate: e.target.value })}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Selling Price (₹)</label>
              <input
                type="number"
                required
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Back to OCR Review</span>
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Encrypting & Storing in MongoDB...</span>
                </>
              ) : (
                <>
                  <span>Publish Listing</span>
                  <Check className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
