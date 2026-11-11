import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { VerifyPaymentSchema } from "@/lib/validations";
import {
  getRazorpayClient,
  RazorpayConfigError,
  verifyRazorpayPaymentSignature,
} from "@/lib/razorpay";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(req, "payment-verify", 20, 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Too many verification requests. Please wait ${rate.reset} seconds.` },
        { status: 429 }
      );
    }

    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to verify payment." },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const parsed = VerifyPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature).",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

    // 1. Retrieve original order from database
    const paymentOrder = await db.payments.findByOrderId(razorpay_order_id);
    if (!paymentOrder) {
      return NextResponse.json(
        { error: "Payment order record not found." },
        { status: 404 }
      );
    }

    // 2. Verify order ownership
    if (String(paymentOrder.userId) !== String(auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to verify another user's payment order." },
        { status: 403 }
      );
    }

    // 3. Enforce Test Mode config before signature check
    const { client } = getRazorpayClient();

    // 4. Cryptographically verify Razorpay Checkout signature with crypto.timingSafeEqual
    const isValidSignature = verifyRazorpayPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Invalid payment signature. Verification rejected." },
        { status: 400 }
      );
    }

    // 5. Idempotency short-circuit if already verified and credited
    if (paymentOrder.coinsCredited && paymentOrder.status === "captured") {
      if (
        paymentOrder.razorpayPaymentId &&
        paymentOrder.razorpayPaymentId !== razorpay_payment_id
      ) {
        return NextResponse.json(
          { error: "Order has already been settled under a different payment ID." },
          { status: 409 }
        );
      }

      const currentUser = await db.users.findById(String(auth.userId));
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        status: "captured",
        mode: "test",
        walletBalance: currentUser?.walletBalance ?? 0,
        coinsCredited: paymentOrder.totalCoins,
        payment: {
          orderId: paymentOrder.razorpayOrderId,
          paymentId: paymentOrder.razorpayPaymentId,
          packageId: paymentOrder.packageId,
          amount: paymentOrder.amount,
          amountInr: paymentOrder.amountInr,
          currency: paymentOrder.currency,
          status: paymentOrder.status,
          paymentMethod: paymentOrder.paymentMethod,
        },
        message: "Payment already verified and coins already credited.",
      });
    }

    // 6. Server-side fetch of authoritative payment details from Razorpay API
    const rzpPayment = await client.payments.fetch(razorpay_payment_id);

    // 7. Confirm payment belongs to the expected order
    if (rzpPayment.order_id !== razorpay_order_id) {
      return NextResponse.json(
        { error: "Payment order mismatch detected during gateway confirmation." },
        { status: 400 }
      );
    }

    // 8. Confirm amount and currency against stored server-side order
    if (
      Number(rzpPayment.amount) !== Number(paymentOrder.amount) ||
      rzpPayment.currency !== paymentOrder.currency
    ) {
      return NextResponse.json(
        { error: "Payment amount or currency does not match the created order." },
        { status: 400 }
      );
    }

    // 9. Handle failed gateway status
    if (rzpPayment.status === "failed") {
      await db.payments.markFailed(razorpay_order_id, {
        razorpayPaymentId: razorpay_payment_id,
        paymentMethod: rzpPayment.method,
        failureCode: rzpPayment.error_code || undefined,
        failureReason: rzpPayment.error_description || "Payment failed at Razorpay gateway.",
      });

      return NextResponse.json(
        {
          success: false,
          status: "failed",
          mode: "test",
          error: rzpPayment.error_description || "Payment failed at the gateway.",
        },
        { status: 400 }
      );
    }

    // 10. Confirm payment is captured before crediting coins (never credit on authorized/created alone)
    if (rzpPayment.status !== "captured" || rzpPayment.captured !== true) {
      await db.payments.markPending(razorpay_order_id, {
        razorpayPaymentId: razorpay_payment_id,
        paymentMethod: rzpPayment.method,
        signatureVerified: true,
      });

      return NextResponse.json(
        {
          success: false,
          status: "pending",
          gatewayStatus: rzpPayment.status,
          mode: "test",
          message:
            "Payment signature verified, but the payment has not been captured yet. Coins will be credited once capture completes.",
        },
        { status: 202 }
      );
    }

    // 11. Idempotently credit coins and record WalletLedger transaction
    const creditResult = await db.payments.creditPaymentIdempotently({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentMethod: rzpPayment.method,
      signatureVerified: true,
    });

    if (!creditResult.success) {
      return NextResponse.json(
        { error: creditResult.error || "Failed to credit coins for payment." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyProcessed: creditResult.alreadyCredited,
      status: "captured",
      mode: "test",
      walletBalance: creditResult.walletBalance ?? 0,
      coinsCredited: paymentOrder.totalCoins,
      payment: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        packageId: paymentOrder.packageId,
        amount: paymentOrder.amount,
        amountInr: paymentOrder.amountInr,
        currency: paymentOrder.currency,
        status: "captured",
        paymentMethod: rzpPayment.method,
      },
      message: creditResult.alreadyCredited
        ? "Payment already verified and coins already credited."
        : `Payment captured! ${paymentOrder.totalCoins} PerkSwap coins credited to your wallet.`,
    });
  } catch (error: any) {
    if (error instanceof RazorpayConfigError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[Payment Verify Error]:", error?.message || "Unknown error");
    return NextResponse.json(
      { error: "Failed to verify Razorpay payment. Please check payment status." },
      { status: 500 }
    );
  }
}
