import { NextResponse } from "next/server";
import { getAuthUser, hashPassword, comparePassword } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const userId = String(auth.userId);
    const user = await db.users.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const allVouchers = await db.vouchers.findMany({});

    // 1. My Listings: Vouchers originally uploaded by user
    const myListings = allVouchers
      .filter(
        (v: any) =>
          String(v.originalSellerId || v.sellerId) === userId &&
          (v.acquisitionSource === "UPLOAD" || !v.acquisitionSource)
      )
      .map((v: any) => ({
        id: v.id || v._id,
        brand: v.brand,
        title: v.title || `${v.brand} Voucher`,
        faceValue: v.faceValue,
        sellingPrice: v.sellingPrice,
        discountType: v.discountType || "FLAT",
        minSpend: v.minSpend || 0,
        status: v.status,
        expiryDate: v.expiryDate,
        createdAt: v.createdAt,
      }));

    // 2. My Coupons: Coupons currently owned by user acquired through PURCHASE or SWAP
    const myCoupons = allVouchers
      .filter(
        (v: any) =>
          String(v.sellerId) === userId &&
          (v.acquisitionSource === "PURCHASE" ||
            v.acquisitionSource === "SWAP" ||
            v.status === "SWAPPED" ||
            v.status === "SOLD")
      )
      .map((v: any) => ({
        id: v.id || v._id,
        brand: v.brand,
        title: v.title || `${v.brand} Voucher`,
        faceValue: v.faceValue,
        sellingPrice: v.sellingPrice,
        discountType: v.discountType || "FLAT",
        minSpend: v.minSpend || 0,
        expiryDate: v.expiryDate,
        source: v.acquisitionSource || (v.status === "SWAPPED" ? "SWAP" : "PURCHASE"),
        receivedDate: v.acquiredAt || v.updatedAt || v.createdAt,
        status: v.status,
      }));

    // 3. User Swaps (Proposals and History)
    const userSwaps = await db.swaps.findUserSwaps(userId);
    const incomingSwaps = userSwaps.filter((s: any) => String(s.requestedId) === userId);
    const outgoingSwaps = userSwaps.filter((s: any) => String(s.requesterId) === userId);
    const swapHistory = userSwaps
      .filter((s: any) => s.status === "ACCEPTED" || s.status === "COMPLETED")
      .map((s: any) => ({
        id: s.id || s._id,
        status: s.status,
        completedAt: s.completedAt || s.updatedAt,
        isIncoming: String(s.requestedId) === userId,
        otherUser: String(s.requestedId) === userId ? s.requester : s.requested,
        offeredVoucher: s.offeredVoucher,
        targetVoucher: s.targetVoucher,
        receivedVoucher: s.receivedVoucher,
        receivedCode: s.receivedCode,
      }));

    // 4. Purchase History (via Escrow transactions)
    const userTxs = await db.transactions.findByUserId(userId);
    const purchaseHistory = await Promise.all(
      userTxs
        .filter((t: any) => String(t.buyerId) === userId)
        .map(async (t: any) => {
          let voucher = t.voucher;
          if (!voucher) {
            voucher = await db.vouchers.findById(String(t.voucherId));
          }
          return {
            id: t.id || t._id,
            voucherId: t.voucherId,
            voucherBrand: voucher?.brand || "Voucher",
            voucherTitle: voucher?.title || `₹${voucher?.faceValue || t.amount} Value`,
            faceValue: voucher?.faceValue || t.amount,
            amount: t.amount,
            platformFee: t.platformFee,
            status: t.status,
            inspectionExpiresAt: t.inspectionExpiresAt,
            releasedAt: t.releasedAt,
            refundedAt: t.refundedAt,
            createdAt: t.createdAt,
          };
        })
    );

    // 5. Wallet Ledger History & Razorpay Payment Records
    const ledger = await db.walletLedger.findByUserId(userId);
    const rawPayments = await db.payments.findByUserId(userId);
    const coinPayments = rawPayments.map((p: any) => ({
      id: p.id || p._id,
      orderId: p.razorpayOrderId,
      paymentId: p.razorpayPaymentId || null,
      packageId: p.packageId,
      packageTitle: p.packageTitle,
      coins: p.coins,
      bonusCoins: p.bonusCoins || 0,
      totalCoins: p.totalCoins,
      amount: p.amount,
      amountInr: p.amountInr,
      currency: p.currency,
      status: p.status,
      paymentMethod: p.paymentMethod || null,
      coinsCredited: Boolean(p.coinsCredited),
      creditedAt: p.creditedAt || null,
      failureReason: p.failureReason || null,
      mode: p.mode || "test",
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      success: true,
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        walletBalance: user.walletBalance,
        trustScore: user.trustScore,
        verified: user.verified,
        completedTrades: user.completedTrades,
        createdAt: user.createdAt,
      },
      myCoupons,
      myListings,
      swapRequests: {
        all: userSwaps,
        incoming: incomingSwaps,
        outgoing: outgoingSwaps,
      },
      purchaseHistory,
      swapHistory,
      walletLedger: ledger,
      coinPayments,
    });
  } catch (error: any) {
    console.error("[Profile API Error]:", error);
    return NextResponse.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const body = await req.json();
    const { name, currentPassword, newPassword } = body;

    const user = await db.users.findById(auth.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password." },
          { status: 400 }
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters long." },
          { status: 400 }
        );
      }

      const isValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: "Incorrect current password." }, { status: 400 });
      }

      const newHash = await hashPassword(newPassword);
      await db.users.updatePassword(user.id || user._id, newHash);
    }

    // If updating name
    if (name && typeof name === "string" && name.trim().length >= 2) {
      await db.users.updateProfile(user.id || user._id, { name: name.trim() });
    }

    const updatedUser = await db.users.findById(auth.userId);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: updatedUser.id || updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        walletBalance: updatedUser.walletBalance,
        trustScore: updatedUser.trustScore,
        verified: updatedUser.verified,
        completedTrades: updatedUser.completedTrades,
      },
    });
  } catch (error: any) {
    console.error("[Update Profile API Error]:", error);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
