export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateRazorpayStartup } = await import("@/lib/razorpay");
    // Throws immediately if a Live Mode key (rzp_live_*) or invalid non-test prefix is configured.
    const status = validateRazorpayStartup({ allowUnconfigured: true });
    if (status.configured) {
      console.info(
        `[Razorpay] Startup check passed: running strictly in TEST MODE (${status.keyPrefix}***).`
      );
    } else {
      console.warn(
        "[Razorpay] Test Mode credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) not yet configured. Add rzp_test_* credentials to .env to enable checkout."
      );
    }
  }
}
