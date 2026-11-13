import { db } from "@/lib/db";

export interface DecayExecutionSummary {
  processedCount: number;
  decayedCount: number;
  totalDiscountApplied: number;
  decayedVouchers: Array<{
    id: string;
    brand: string;
    oldPrice: number;
    newPrice: number;
    rate: number;
  }>;
}

export class PriceDecayEngine {
  /**
   * Executes price decay on all active vouchers enrolled in automated decay.
   * Can be triggered via cron job or API endpoint /api/cron/price-decay.
   */
  static async runDecayCycle(): Promise<DecayExecutionSummary> {
    const summary: DecayExecutionSummary = {
      processedCount: 0,
      decayedCount: 0,
      totalDiscountApplied: 0,
      decayedVouchers: [],
    };

    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Find all active vouchers with autoPriceDecay enabled that haven't been decayed in the last 24 hours
      const allActive = await db.vouchers.findMany({ status: "ACTIVE" });
      const eligibleVouchers = allActive.filter((voucher: any) => {
        if (!voucher.autoPriceDecay) return false;
        if (!voucher.lastDecayedAt) return true;
        return new Date(voucher.lastDecayedAt) <= twentyFourHoursAgo;
      });

      summary.processedCount = eligibleVouchers.length;

      for (const voucher of eligibleVouchers) {
        const decayRate = voucher.priceDecayRate || 0.05; // 5% default
        const priceReduction = voucher.sellingPrice * decayRate;
        const newPrice = Math.max(
          Math.round(voucher.faceValue * 0.2), // Safety floor: minimum 20% of face value
          Math.round(voucher.sellingPrice - priceReduction)
        );

        if (newPrice < voucher.sellingPrice) {
          const discountAmount = voucher.sellingPrice - newPrice;

          await db.vouchers.update(voucher.id, {
            sellingPrice: newPrice,
            lastDecayedAt: now,
          });

          summary.decayedCount++;
          summary.totalDiscountApplied += discountAmount;
          summary.decayedVouchers.push({
            id: voucher.id,
            brand: voucher.brand,
            oldPrice: voucher.sellingPrice,
            newPrice,
            rate: decayRate,
          });
        }
      }

      console.log(
        `[PriceDecayEngine] Completed cycle. Processed: ${summary.processedCount}, Decayed: ${summary.decayedCount}`
      );
      return summary;
    } catch (error) {
      console.error("[PriceDecayEngine] Error during decay cycle:", error);
      return summary;
    }
  }
}
