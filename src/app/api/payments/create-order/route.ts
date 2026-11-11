import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { CreatePaymentOrderSchema } from "@/lib/validations";
import { COIN_PACKAGES } from "@/lib/constants";
import { getRazorpayClient, RazorpayConfigError } from "@/lib/razorpay";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(req, "payment-create-order", 10, 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Too many payment order requests. Please wait ${rate.reset} seconds.` },
        { status: 429 }
      );
    }

    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to purchase coin packages." },
        { status: 401 }
      );
    }

    const user = await db.users.findById(String(auth.userId));
    if (!user) {
      return NextResponse.json({ error: "Authenticated user account not found." }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const parsed = CreatePaymentOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Invalid request payload. Only packageId is accepted; payable amount is calculated on the server.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { packageId } = parsed.data;
    const selectedPkg = COIN_PACKAGES.find((p) => p.id === packageId);
    if (!selectedPkg) {
      return NextResponse.json(
        { error: `Invalid coin package '${packageId}'.` },
        { status: 400 }
      );
    }

    // Strict Test Mode client initialization (rejects live keys)
    const { client, keyId } = getRazorpayClient();

    const amountPaise = Math.round(selectedPkg.priceInr * 100);
    const bonusCoins = selectedPkg.bonusCoins || 0;
    const totalCoins = selectedPkg.coins + bonusCoins;
    const receipt = `ps_${Date.now()}_${String(auth.userId).slice(-6)}`.slice(0, 40);

    const rzpOrder = await client.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        userId: String(auth.userId),
        packageId: selectedPkg.id,
        coins: String(selectedPkg.coins),
        bonusCoins: String(bonusCoins),
        mode: "test",
      },
    });

    await db.payments.create({
      userId: String(auth.userId),
      packageId: selectedPkg.id,
      packageTitle: selectedPkg.title,
      coins: selectedPkg.coins,
      bonusCoins,
      totalCoins,
      razorpayOrderId: rzpOrder.id,
      amount: amountPaise,
      amountInr: selectedPkg.priceInr,
      currency: "INR",
      status: "created",
      receipt,
      mode: "test",
    });

    return NextResponse.json(
      {
        success: true,
        mode: "test",
        orderId: rzpOrder.id,
        amount: amountPaise,
        amountInr: selectedPkg.priceInr,
        currency: "INR",
        keyId,
        package: {
          id: selectedPkg.id,
          title: selectedPkg.title,
          coins: selectedPkg.coins,
          bonusCoins,
          totalCoins,
          priceInr: selectedPkg.priceInr,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof RazorpayConfigError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[Payment Create Order Error]:", error?.message || "Unknown error");
    return NextResponse.json(
      { error: "Unable to create Razorpay Test Mode order. Please try again." },
      { status: 500 }
    );
  }
}
