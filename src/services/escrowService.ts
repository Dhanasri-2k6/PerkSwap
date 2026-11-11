import { prisma } from "@/lib/prisma";
import { decryptVoucherCode } from "@/lib/crypto";

export interface EscrowInitiateResult {
  success: boolean;
  transactionId?: string;
  voucherId?: string;
  amount?: number;
  unmaskedCode?: string;
  expiresAt?: string;
  error?: string;
}

export interface EscrowReleaseResult {
  success: boolean;
  transactionId?: string;
  sellerEarnings?: number;
  platformFee?: number;
  error?: string;
}

const PLATFORM_FEE_PERCENT = Number(process.env.ESCROW_FEE_PERCENT || "5");
const INSPECTION_HOURS = Number(process.env.ESCROW_INSPECTION_HOURS || "2");

export class EscrowService {
  /**
   * Initiates an escrow transaction:
   * 1. Verifies buyer has adequate balance.
   * 2. Locks funds atomically.
   * 3. Changes voucher status to IN_ESCROW.
   * 4. Unmasks and returns the code immediately to the buyer.
   */
  static async initiateEscrow(buyerId: string, voucherId: string): Promise<EscrowInitiateResult> {
    try {
      const voucher = await prisma.voucher.findUnique({
        where: { id: voucherId },
        include: { seller: true },
      });

      if (!voucher) {
        return { success: false, error: "Voucher not found." };
      }

      if (voucher.status !== "ACTIVE") {
        return { success: false, error: `Voucher is not available for purchase (current status: ${voucher.status}).` };
      }

      if (voucher.sellerId === buyerId) {
        return { success: false, error: "You cannot purchase your own voucher." };
      }

      const buyer = await prisma.user.findUnique({
        where: { id: buyerId },
      });

      if (!buyer) {
        return { success: false, error: "Buyer profile not found." };
      }

      if (buyer.walletBalance < voucher.sellingPrice) {
        return {
          success: false,
          error: `Insufficient wallet balance (Current: ₹${buyer.walletBalance.toFixed(2)}, Required: ₹${voucher.sellingPrice.toFixed(2)}). Please top up your sandbox wallet.`,
        };
      }

      const platformFee = Math.round((voucher.sellingPrice * (PLATFORM_FEE_PERCENT / 100)) * 100) / 100;
      const sellerEarnings = Math.round((voucher.sellingPrice - platformFee) * 100) / 100;
      const inspectionDeadline = new Date(Date.now() + INSPECTION_HOURS * 60 * 60 * 1000);

      // Atomic transaction: Deduct balance, update voucher status, create escrow record
      const [updatedBuyer, updatedVoucher, transaction] = await prisma.$transaction([
        prisma.user.update({
          where: { id: buyerId },
          data: {
            walletBalance: { decrement: voucher.sellingPrice },
          },
        }),
        prisma.voucher.update({
          where: { id: voucherId },
          data: {
            status: "IN_ESCROW",
          },
        }),
        prisma.transaction.create({
          data: {
            buyerId,
            sellerId: voucher.sellerId,
            voucherId: voucher.id,
            amount: voucher.sellingPrice,
            platformFee,
            sellerEarnings,
            status: "HELD_IN_ESCROW",
            expiresAt: inspectionDeadline,
          },
        }),
      ]);

      // Decrypt voucher code for the authorized buyer
      let unmaskedCode = "VOUCHER-REVEALED";
      if (voucher.code && voucher.codeIv && voucher.codeTag) {
        try {
          unmaskedCode = decryptVoucherCode(voucher.code, voucher.codeIv, voucher.codeTag);
        } catch (decryptErr) {
          console.error("Failed to decrypt code during escrow:", decryptErr);
          unmaskedCode = "SECURE-CODE-DECRYPT-PENDING";
        }
      }

      return {
        success: true,
        transactionId: transaction.id,
        voucherId: voucher.id,
        amount: transaction.amount,
        unmaskedCode,
        expiresAt: transaction.expiresAt.toISOString(),
      };
    } catch (err: any) {
      console.error("[EscrowService.initiateEscrow] Error:", err);
      return { success: false, error: err.message || "Failed to initiate escrow transaction." };
    }
  }

  /**
   * Releases escrow funds to seller (minus platform fee) upon buyer verification or timer expiration.
   */
  static async releaseEscrow(callerUserId: string, transactionId: string): Promise<EscrowReleaseResult> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { voucher: true, seller: true },
      });

      if (!transaction) {
        return { success: false, error: "Transaction not found." };
      }

      if (transaction.status !== "HELD_IN_ESCROW") {
        return { success: false, error: `Escrow cannot be released. Current status: ${transaction.status}.` };
      }

      // Check caller authorization: buyer or system
      if (transaction.buyerId !== callerUserId && callerUserId !== "SYSTEM_WORKER") {
        return { success: false, error: "Only the buyer or automated system can release escrow." };
      }

      // Atomic release: Credit seller, mark transaction RELEASED, mark voucher SOLD
      const [updatedSeller, updatedTx, updatedVoucher] = await prisma.$transaction([
        prisma.user.update({
          where: { id: transaction.sellerId },
          data: {
            walletBalance: { increment: transaction.sellerEarnings },
            completedTrades: { increment: 1 },
            trustScore: { increment: 2 }, // Positive trade reputation boost
          },
        }),
        prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
          },
        }),
        prisma.voucher.update({
          where: { id: transaction.voucherId },
          data: {
            status: "SOLD",
          },
        }),
      ]);

      return {
        success: true,
        transactionId: updatedTx.id,
        sellerEarnings: transaction.sellerEarnings,
        platformFee: transaction.platformFee,
      };
    } catch (err: any) {
      console.error("[EscrowService.releaseEscrow] Error:", err);
      return { success: false, error: err.message || "Failed to release escrow funds." };
    }
  }

  /**
   * Raises a dispute on an active escrow transaction before the inspection window closes.
   */
  static async raiseDispute(
    buyerId: string,
    transactionId: string,
    reason: string,
    evidenceUrl?: string
  ): Promise<{ success: boolean; disputeId?: string; error?: string }> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        return { success: false, error: "Transaction not found." };
      }

      if (transaction.buyerId !== buyerId) {
        return { success: false, error: "Only the buyer can initiate a dispute for this transaction." };
      }

      if (transaction.status !== "HELD_IN_ESCROW") {
        return { success: false, error: `Cannot dispute transaction in status: ${transaction.status}.` };
      }

      // Atomic dispute creation & transaction status update
      const [dispute, updatedTx, updatedSeller] = await prisma.$transaction([
        prisma.dispute.create({
          data: {
            transactionId,
            initiatorId: buyerId,
            reason,
            evidenceUrl,
            status: "OPEN",
          },
        }),
        prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: "DISPUTED",
          },
        }),
        prisma.user.update({
          where: { id: transaction.sellerId },
          data: {
            disputeCount: { increment: 1 },
            trustScore: { decrement: 5 }, // Trust penalty for dispute investigation
          },
        }),
      ]);

      return {
        success: true,
        disputeId: dispute.id,
      };
    } catch (err: any) {
      console.error("[EscrowService.raiseDispute] Error:", err);
      return { success: false, error: err.message || "Failed to submit dispute." };
    }
  }
}
