import { db } from "@/lib/db";
import { decryptVoucher } from "@/lib/crypto";

export interface SwapProposalResult {
  success: boolean;
  swapRequestId?: string;
  error?: string;
}

export interface SwapAcceptResult {
  success: boolean;
  swapRequestId?: string;
  revealedOfferedCode?: string;
  revealedTargetCode?: string;
  receivedCode?: string;
  error?: string;
}

export class SwapService {
  /**
   * Proposes swapping an offered voucher for a target listed voucher.
   */
  static async proposeSwap(
    requesterId: string,
    offeredVoucherId: string,
    targetVoucherId: string,
    notes?: string
  ): Promise<SwapProposalResult> {
    try {
      if (offeredVoucherId === targetVoucherId) {
        return { success: false, error: "Cannot swap a voucher with itself." };
      }

      const [offered, target] = await Promise.all([
        db.vouchers.findById(offeredVoucherId),
        db.vouchers.findById(targetVoucherId),
      ]);

      if (!offered || !target) {
        return { success: false, error: "One or both vouchers could not be found." };
      }

      if (String(offered.sellerId) !== String(requesterId)) {
        return { success: false, error: "You can only offer vouchers you personally own." };
      }

      if (String(target.sellerId) === String(requesterId)) {
        return { success: false, error: "You already own the target voucher." };
      }

      if (offered.status !== "ACTIVE" || target.status !== "ACTIVE") {
        return { success: false, error: "Both vouchers must be in ACTIVE status to initiate a swap." };
      }

      const swap = await db.swaps.create({
        requesterId: String(requesterId),
        requestedId: String(target.sellerId),
        offeredVoucherId: String(offeredVoucherId),
        targetVoucherId: String(targetVoucherId),
        notes: notes || `Direct P2P Swap Request: ${offered.brand} for ${target.brand}`,
        status: "PENDING",
      });

      return {
        success: true,
        swapRequestId: swap.id,
      };
    } catch (err: any) {
      console.error("[SwapService.proposeSwap] Error:", err);
      return { success: false, error: err.message || "Failed to submit swap proposal." };
    }
  }

  /**
   * Accepts a swap proposal:
   * Atomically swaps voucher ownership, marks both SWAPPED, and reveals actual codes.
   */
  static async acceptSwap(requestedUserId: string, swapRequestId: string): Promise<SwapAcceptResult> {
    try {
      const result = await db.swaps.executeSwap(swapRequestId, requestedUserId);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        swapRequestId: result.swapId,
        revealedOfferedCode: result.revealedOfferedCode,
        revealedTargetCode: result.revealedTargetCode,
        receivedCode: result.receivedCode,
      };
    } catch (err: any) {
      console.error("[SwapService.acceptSwap] Error:", err);
      return { success: false, error: err.message || "Failed to execute voucher swap." };
    }
  }

  /**
   * Declines a swap proposal.
   */
  static async declineSwap(requestedUserId: string, swapRequestId: string) {
    try {
      const swap = await db.swaps.findById(swapRequestId);

      if (!swap || String(swap.requestedId) !== String(requestedUserId)) {
        return { success: false, error: "Unauthorized or proposal not found." };
      }

      if (swap.status !== "PENDING") {
        return { success: false, error: `Cannot decline a swap that is already ${swap.status}.` };
      }

      await db.swaps.update(swapRequestId, { status: "DECLINED" });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to decline swap." };
    }
  }
}
