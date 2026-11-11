import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getRazorpayClient, validateRazorpayStartup } from "@/lib/razorpay";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const rate = checkRateLimit(req, "payment-status", 30, 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Too many status requests. Please wait ${rate.reset} seconds.` },
        { status: 429 }
      );
    }

    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to inspect payment status." },
        { status: 401 }
      );
    }

    const { orderId } = await params;
    if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
      return NextResponse.json({ error: "Valid orderId parameter is required." }, { status: 400 });
    }

    let payment = await db.payments.findByOrderId(orderId.trim());
    if (!payment) {
      return NextResponse.json({ error: "Payment order not found." }, { status: 404 });
    }

    if (String(payment.userId) !== String(auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: You cannot inspect another user's payment order." },
        { status: 403 }
      );
    }

    // Reconcile unsettled orders directly against Razorpay Test Mode API
    // so captured payments settle cleanly even if client redirect/webhook was missed,
    // while authorized/uncaptured payments never get credited prematurely.
    if (!payment.coinsCredited && payment.status !== "captured") {
      try {
        const startup = validateRazorpayStartup({ allowUnconfigured: true });
        if (startup.configured) {
          const { client } = getRazorpayClient();
          const orderPayments = await client.orders.fetchPayments(payment.razorpayOrderId);
          const items: any[] = Array.isArray(orderPayments?.items) ? orderPayments.items : [];

          const capturedItem = items.find(
            (p: any) =>
              p.status === "captured" &&
              p.captured === true &&
              (!p.order_id || p.order_id === payment.razorpayOrderId) &&
              Number(p.amount) === Number(payment.amount) &&
              p.currency === payment.currency
          );

          if (capturedItem?.id) {
            await db.payments.creditPaymentIdempotently({
              razorpayOrderId: payment.razorpayOrderId,
              razorpayPaymentId: capturedItem.id,
              paymentMethod: capturedItem.method,
            });
            payment = (await db.payments.findByOrderId(payment.razorpayOrderId)) || payment;
          } else {
            const authorizedItem = items.find(
              (p: any) =>
                p.status === "authorized" &&
                p.captured !== true &&
                (!p.order_id || p.order_id === payment.razorpayOrderId)
            );
            if (authorizedItem && payment.status !== "pending") {
              payment =
                (await db.payments.markPending(payment.razorpayOrderId, {
                  razorpayPaymentId: authorizedItem.id,
                  paymentMethod: authorizedItem.method,
                })) || payment;
            } else if (!authorizedItem && items.length > 0 && payment.status === "created") {
              const latestFailed = items.find((p: any) => p.status === "failed");
              if (latestFailed) {
                payment =
                  (await db.payments.markFailed(payment.razorpayOrderId, {
                    razorpayPaymentId: latestFailed.id,
                    paymentMethod: latestFailed.method,
                    failureCode: latestFailed.error_code || undefined,
                    failureReason:
                      latestFailed.error_description || "Payment failed at Razorpay gateway.",
                  })) || payment;
              }
            }
          }
        }
      } catch {
        // Non-fatal: return local DB state if gateway reconciliation poll fails temporarily
      }
    }

    const user = await db.users.findById(String(auth.userId));

    return NextResponse.json({
      success: true,
      mode: "test",
      walletBalance: user?.walletBalance ?? 0,
      payment: {
        id: payment.id,
        orderId: payment.razorpayOrderId,
        paymentId: payment.razorpayPaymentId || null,
        packageId: payment.packageId,
        packageTitle: payment.packageTitle,
        coins: payment.coins,
        bonusCoins: payment.bonusCoins || 0,
        totalCoins: payment.totalCoins,
        amount: payment.amount,
        amountInr: payment.amountInr,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod || null,
        coinsCredited: Boolean(payment.coinsCredited),
        creditedAt: payment.creditedAt || null,
        failureReason: payment.failureReason || null,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("[Payment Status API Error]:", error?.message || "Unknown error");
    return NextResponse.json(
      { error: "Failed to retrieve payment status." },
      { status: 500 }
    );
  }
}
