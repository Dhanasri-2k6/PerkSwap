import { NextResponse } from "next/server";
import {
  getRazorpayClient,
  RazorpayConfigError,
  validateRazorpayStartup,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";
import { db } from "@/lib/db";

// Ensure Node.js runtime and dynamic execution so raw body is never cached/altered
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Strictly reject live keys
    validateRazorpayStartup({ allowUnconfigured: true });

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "RAZORPAY_WEBHOOK_SECRET is not configured on the server." },
        { status: 503 }
      );
    }

    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing X-Razorpay-Signature header." },
        { status: 400 }
      );
    }

    // Read raw request body BEFORE JSON parsing (equivalent to handling raw stream before express.json())
    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: "Empty webhook request body." }, { status: 400 });
    }

    const isSignatureValid = verifyRazorpayWebhookSignature({
      rawBody,
      signature,
      secret: webhookSecret,
    });

    if (!isSignatureValid) {
      return NextResponse.json(
        { error: "Invalid X-Razorpay-Signature." },
        { status: 400 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Malformed JSON webhook payload." }, { status: 400 });
    }

    const event: string = String(payload?.event || "");
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderEntity = payload?.payload?.order?.entity;

    const headerEventId = req.headers.get("x-razorpay-event-id")?.trim();
    const webhookEventId =
      headerEventId ||
      `${event}:${paymentEntity?.id || orderEntity?.id || "unknown"}:${
        paymentEntity?.status || orderEntity?.status || "none"
      }:${payload?.created_at ?? ""}`;

    if (event === "payment.captured") {
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const amount = Number(paymentEntity?.amount);
      const currency = paymentEntity?.currency;
      const method = paymentEntity?.method;

      if (!orderId || !paymentId) {
        return NextResponse.json(
          { error: "Webhook payment.captured payload missing order_id or payment id." },
          { status: 400 }
        );
      }

      const storedOrder = await db.payments.findByOrderId(orderId);
      if (!storedOrder) {
        return NextResponse.json({
          received: true,
          ignored: true,
          reason: "Order record not found on PerkSwap.",
        });
      }

      if (
        Array.isArray(storedOrder.processedWebhookEvents) &&
        storedOrder.processedWebhookEvents.includes(webhookEventId)
      ) {
        return NextResponse.json({
          received: true,
          event,
          orderId,
          paymentId,
          status: storedOrder.status,
          alreadyProcessed: true,
        });
      }

      if (
        !Number.isFinite(amount) ||
        amount !== Number(storedOrder.amount) ||
        currency !== storedOrder.currency
      ) {
        return NextResponse.json(
          { error: "Webhook payment amount or currency mismatch." },
          { status: 400 }
        );
      }

      if (paymentEntity?.status !== "captured" || paymentEntity?.captured !== true) {
        return NextResponse.json({
          received: true,
          ignored: true,
          reason: "Payment entity is not strictly captured.",
        });
      }

      const result = await db.payments.creditPaymentIdempotently({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        paymentMethod: method,
        webhookEventId,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to settle webhook payment." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        received: true,
        event,
        orderId,
        paymentId,
        status: "captured",
        alreadyProcessed: result.alreadyCredited || Boolean(result.duplicateWebhookEvent),
      });
    }

    if (event === "order.paid") {
      const orderId = orderEntity?.id;
      if (!orderId) {
        return NextResponse.json(
          { error: "Webhook order.paid payload missing order entity id." },
          { status: 400 }
        );
      }

      const storedOrder = await db.payments.findByOrderId(orderId);
      if (!storedOrder) {
        return NextResponse.json({
          received: true,
          ignored: true,
          reason: "Order record not found on PerkSwap.",
        });
      }

      if (
        Array.isArray(storedOrder.processedWebhookEvents) &&
        storedOrder.processedWebhookEvents.includes(webhookEventId)
      ) {
        return NextResponse.json({
          received: true,
          event,
          orderId,
          status: storedOrder.status,
          alreadyProcessed: true,
        });
      }

      const amountPaid = Number(orderEntity?.amount_paid);
      if (
        !Number.isFinite(amountPaid) ||
        amountPaid < Number(storedOrder.amount) ||
        orderEntity?.currency !== storedOrder.currency ||
        orderEntity?.status !== "paid"
      ) {
        return NextResponse.json(
          { error: "Order paid payload does not satisfy stored order requirements." },
          { status: 400 }
        );
      }

      const hasValidCapturedEntity =
        paymentEntity?.status === "captured" &&
        paymentEntity?.captured === true &&
        (!paymentEntity?.order_id || paymentEntity.order_id === orderId) &&
        Number(paymentEntity?.amount) === Number(storedOrder.amount) &&
        paymentEntity?.currency === storedOrder.currency;

      let capturedPaymentId = hasValidCapturedEntity ? paymentEntity?.id : undefined;
      let paymentMethod = hasValidCapturedEntity ? paymentEntity?.method : undefined;

      // If payment entity wasn't bundled in order.paid, fetch captured payment via server API
      if (!capturedPaymentId && !storedOrder.coinsCredited) {
        const { client } = getRazorpayClient();
        const orderPayments = await client.orders.fetchPayments(orderId);
        const capturedItem = orderPayments?.items?.find(
          (p: any) =>
            p.status === "captured" &&
            p.captured === true &&
            (!p.order_id || p.order_id === orderId) &&
            Number(p.amount) === Number(storedOrder.amount) &&
            p.currency === storedOrder.currency
        );
        if (capturedItem) {
          capturedPaymentId = capturedItem.id;
          paymentMethod = capturedItem.method;
        }
      }

      if (!capturedPaymentId && !storedOrder.coinsCredited) {
        return NextResponse.json({
          received: true,
          ignored: true,
          reason: "No captured payment confirmed for order.paid event yet.",
        });
      }

      const effectivePaymentId = capturedPaymentId || storedOrder.razorpayPaymentId;
      if (!effectivePaymentId) {
        return NextResponse.json({
          received: true,
          ignored: true,
          reason: "Missing captured payment identifier for order.paid reconciliation.",
        });
      }

      const result = await db.payments.creditPaymentIdempotently({
        razorpayOrderId: orderId,
        razorpayPaymentId: effectivePaymentId,
        paymentMethod,
        webhookEventId,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to settle order.paid webhook." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        received: true,
        event,
        orderId,
        status: "captured",
        alreadyProcessed: result.alreadyCredited || Boolean(result.duplicateWebhookEvent),
      });
    }

    if (event === "payment.authorized") {
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const amount = Number(paymentEntity?.amount);
      const currency = paymentEntity?.currency;

      if (!orderId || !paymentId) {
        return NextResponse.json({ received: true, ignored: true });
      }

      const storedOrder = await db.payments.findByOrderId(orderId);
      if (!storedOrder) {
        return NextResponse.json({ received: true, ignored: true });
      }

      if (
        Array.isArray(storedOrder.processedWebhookEvents) &&
        storedOrder.processedWebhookEvents.includes(webhookEventId)
      ) {
        return NextResponse.json({
          received: true,
          event,
          orderId,
          status: storedOrder.status,
          alreadyProcessed: true,
        });
      }

      if (
        !Number.isFinite(amount) ||
        amount !== Number(storedOrder.amount) ||
        currency !== storedOrder.currency
      ) {
        return NextResponse.json(
          { error: "Webhook payment amount or currency mismatch." },
          { status: 400 }
        );
      }

      const updated = await db.payments.markPending(orderId, {
        razorpayPaymentId: paymentId,
        paymentMethod: paymentEntity?.method,
        webhookEventId,
      });

      return NextResponse.json({
        received: true,
        event,
        orderId,
        paymentId,
        status: updated?.status || storedOrder.status,
        coinsCredited: false,
      });
    }

    if (event === "payment.failed") {
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (!orderId) {
        return NextResponse.json({ received: true, ignored: true });
      }

      const storedOrder = await db.payments.findByOrderId(orderId);
      if (!storedOrder) {
        return NextResponse.json({ received: true, ignored: true });
      }

      const alreadyRecordedEvent =
        Array.isArray(storedOrder.processedWebhookEvents) &&
        storedOrder.processedWebhookEvents.includes(webhookEventId);

      if (alreadyRecordedEvent) {
        return NextResponse.json({
          received: true,
          event,
          orderId,
          status: storedOrder.status,
          alreadyProcessed: true,
        });
      }

      // Do not regress a newer authorized payment in pending state due to an older paymentId failure
      if (
        storedOrder.status === "pending" &&
        storedOrder.razorpayPaymentId &&
        paymentId &&
        storedOrder.razorpayPaymentId !== paymentId
      ) {
        return NextResponse.json({
          received: true,
          event,
          orderId,
          ignored: true,
          status: storedOrder.status,
        });
      }

      const updated = await db.payments.markFailed(orderId, {
        razorpayPaymentId: paymentId,
        paymentMethod: paymentEntity?.method,
        failureCode: paymentEntity?.error_code || undefined,
        failureReason: paymentEntity?.error_description || "Payment failed.",
        webhookEventId,
      });

      return NextResponse.json({
        received: true,
        event,
        orderId,
        status: updated?.status || storedOrder.status,
        alreadyProcessed: alreadyRecordedEvent,
      });
    }

    // Acknowledge other valid signed Razorpay webhook events cleanly
    return NextResponse.json({
      received: true,
      ignored: true,
      event,
    });
  } catch (error: any) {
    if (error instanceof RazorpayConfigError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[Payment Webhook Error]:", error?.message || "Unknown error");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
