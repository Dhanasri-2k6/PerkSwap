import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { decryptVoucherCode } from "@/lib/crypto";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const voucher = await db.vouchers.findById(id);

    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found." }, { status: 404 });
    }

    const auth = getAuthUser(req);
    const callerId = auth?.userId;

    let unmaskedCode: string | null = null;
    let isAuthorized = false;

    // Check if caller is seller
    if (callerId && String(voucher.sellerId) === String(callerId)) {
      isAuthorized = true;
    }

    // Check if caller is verified buyer in active escrow or completed sale
    if (callerId && (voucher.status === "IN_ESCROW" || voucher.status === "SOLD")) {
      const tx = await db.transactions.findByVoucherId(id);
      if (tx && String(tx.buyerId) === String(callerId)) {
        isAuthorized = true;
      }
    }

    const cipher = voucher.encryptedCode || voucher.code;
    const iv = voucher.iv || voucher.codeIv;
    const tag = voucher.tag || voucher.codeTag;

    if (isAuthorized && cipher && iv && tag) {
      try {
        unmaskedCode = decryptVoucherCode(cipher, iv, tag);
      } catch (err) {
        console.error("Decryption failed:", err);
      }
    }

    const discountPercent = Math.round(
      ((voucher.faceValue - voucher.sellingPrice) / voucher.faceValue) * 100
    );

    const safe = { ...voucher };
    delete safe.encryptedCode;
    delete safe.iv;
    delete safe.tag;
    delete safe.codeIv;
    delete safe.codeTag;
    delete safe.codeHash;

    return NextResponse.json({
      success: true,
      voucher: {
        ...safe,
        code: unmaskedCode || "••••••••••••",
        isCodeRevealed: !!unmaskedCode,
        discountPercent: Math.max(0, discountPercent),
      },
    });
  } catch (error: any) {
    console.error("[Voucher Detail API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch voucher details." }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const { id } = await params;
    const voucher = await db.vouchers.findById(id);

    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found." }, { status: 404 });
    }

    // Verify ownership
    if (String(voucher.sellerId) !== String(auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: You cannot modify another user's voucher listing." },
        { status: 403 }
      );
    }

    if (voucher.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Cannot modify a voucher that is currently ${voucher.status}.` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { title, description, sellingPrice, minSpend } = body;

    const updates: any = {};
    if (title) updates.title = title;
    if (description) updates.description = description;
    if (sellingPrice && Number(sellingPrice) > 0) updates.sellingPrice = Number(sellingPrice);
    if (minSpend !== undefined) updates.minSpend = Number(minSpend);

    const updated = await db.vouchers.update(id, updates);

    return NextResponse.json({
      success: true,
      message: "Listing updated successfully.",
      voucher: updated,
    });
  } catch (error: any) {
    console.error("[Voucher Update API] Error:", error);
    return NextResponse.json({ error: "Failed to update voucher." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const { id } = await params;
    const voucher = await db.vouchers.findById(id);

    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found." }, { status: 404 });
    }

    // Verify ownership
    if (String(voucher.sellerId) !== String(auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: You cannot delete another user's voucher listing." },
        { status: 403 }
      );
    }

    if (voucher.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Cannot delete a voucher that is currently ${voucher.status}.` },
        { status: 400 }
      );
    }

    await db.vouchers.delete(id);

    return NextResponse.json({
      success: true,
      message: "Listing deleted successfully.",
    });
  } catch (error: any) {
    console.error("[Voucher Delete API] Error:", error);
    return NextResponse.json({ error: "Failed to delete voucher." }, { status: 500 });
  }
}
