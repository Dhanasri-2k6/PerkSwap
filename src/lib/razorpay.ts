import crypto from "crypto";
import dotenv from "dotenv";
import Razorpay from "razorpay";

// Load .env if running outside Next.js native env loader (e.g. standalone scripts/tests)
if (!process.env.RAZORPAY_KEY_ID) {
  dotenv.config({ quiet: true });
}

export class RazorpayConfigError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "RazorpayConfigError";
    this.statusCode = statusCode;
  }
}

/**
 * Strictly enforces Razorpay TEST MODE ONLY.
 * Rejects any Live Mode key (rzp_live_*) or malformed key.
 */
export function assertTestModeKey(keyId: string): void {
  const trimmed = keyId.trim();
  if (trimmed.startsWith("rzp_live_")) {
    throw new RazorpayConfigError(
      "SECURITY BLOCK: Live Razorpay API keys (rzp_live_*) are strictly prohibited. This integration is restricted exclusively to Razorpay TEST MODE (rzp_test_*).",
      500
    );
  }
  if (!trimmed.startsWith("rzp_test_") || trimmed.length <= 9) {
    throw new RazorpayConfigError(
      "INVALID RAZORPAY KEY: RAZORPAY_KEY_ID must be a valid Razorpay Test Mode key beginning with 'rzp_test_'.",
      500
    );
  }
}

export interface RazorpayStartupStatus {
  configured: boolean;
  mode: "test";
  hasWebhookSecret: boolean;
  keyPrefix?: string;
}

/**
 * Validates Razorpay environment configuration during startup or before payment operations.
 * Rejects live keys immediately even if allowUnconfigured is true.
 */
export function validateRazorpayStartup(options?: {
  allowUnconfigured?: boolean;
}): RazorpayStartupStatus {
  const allowUnconfigured = options?.allowUnconfigured ?? true;
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";
  const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || "";

  // Even if unconfigured elsewhere, NEVER permit a live key in any env var
  if (publicKeyId) {
    assertTestModeKey(publicKeyId);
  }
  if (keyId) {
    assertTestModeKey(keyId);
  }

  if (!keyId || !keySecret) {
    if (!allowUnconfigured) {
      throw new RazorpayConfigError(
        "Razorpay Test Mode credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are not configured on the server.",
        503
      );
    }
    return {
      configured: false,
      mode: "test",
      hasWebhookSecret: Boolean(webhookSecret),
    };
  }

  return {
    configured: true,
    mode: "test",
    hasWebhookSecret: Boolean(webhookSecret),
    keyPrefix: "rzp_test_",
  };
}

/**
 * Returns a server-only Razorpay SDK client strictly verified for TEST MODE.
 * Never returns or exposes RAZORPAY_KEY_SECRET or RAZORPAY_WEBHOOK_SECRET.
 */
export function getRazorpayClient(): { client: Razorpay; keyId: string } {
  validateRazorpayStartup({ allowUnconfigured: false });

  const keyId = process.env.RAZORPAY_KEY_ID!.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET!.trim();

  assertTestModeKey(keyId);

  const client = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return { client, keyId };
}

/**
 * Verifies Razorpay Checkout signature: HMAC-SHA256(orderId + "|" + paymentId, RAZORPAY_KEY_SECRET)
 * Uses crypto.timingSafeEqual for constant-time comparison.
 */
export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}): boolean {
  const keySecret = (params.secret ?? process.env.RAZORPAY_KEY_SECRET ?? "").trim();
  if (!keySecret || !params.orderId || !params.paymentId || !params.signature) {
    return false;
  }

  const receivedSig = params.signature.trim();
  if (!/^[0-9a-f]{64}$/i.test(receivedSig)) {
    return false;
  }

  const expectedHex = crypto
    .createHmac("sha256", keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "hex");
  const receivedBuf = Buffer.from(receivedSig, "hex");

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Verifies Razorpay Webhook X-Razorpay-Signature against raw request body using HMAC-SHA256
 * and crypto.timingSafeEqual.
 */
export function verifyRazorpayWebhookSignature(params: {
  rawBody: string;
  signature: string;
  secret?: string;
}): boolean {
  const webhookSecret = (params.secret ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim();
  if (!webhookSecret || !params.rawBody || !params.signature) {
    return false;
  }

  const receivedSig = params.signature.trim();
  if (!/^[0-9a-f]{64}$/i.test(receivedSig)) {
    return false;
  }

  const expectedHex = crypto
    .createHmac("sha256", webhookSecret)
    .update(params.rawBody, "utf8")
    .digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "hex");
  const receivedBuf = Buffer.from(receivedSig, "hex");

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
