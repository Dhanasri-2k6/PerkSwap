import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get("brand") || undefined;
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search")?.toLowerCase();
    const mine = searchParams.get("mine") === "true";

    let vouchers: any[] = [];

    if (mine) {
      const auth = getAuthUser(req);
      if (!auth) {
        return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
      }
      const allVouchers = await db.vouchers.findMany({});
      vouchers = allVouchers.filter((v: any) => String(v.sellerId) === String(auth.userId));
    } else {
      const filters: any = {
        status: "ACTIVE",
      };
      if (brand) filters.brand = brand;
      if (category && category !== "ALL") filters.category = category;

      vouchers = await db.vouchers.findMany(filters);
    }

    if (search) {
      vouchers = vouchers.filter(
        (v: any) =>
          v.brand.toLowerCase().includes(search) ||
          (v.title && v.title.toLowerCase().includes(search)) ||
          v.category.toLowerCase().includes(search)
      );
    }

    // Security Rule: NEVER expose encryptedCode, iv, or tag in public queries
    const safeVouchers = vouchers.map((v: any) => {
      const discountPercent = Math.round(((v.faceValue - v.sellingPrice) / v.faceValue) * 100);
      const safe = { ...v };
      delete safe.encryptedCode;
      delete safe.iv;
      delete safe.tag;
      delete safe.codeIv;
      delete safe.codeTag;
      delete safe.codeHash;
      safe.code = "••••••••••••";
      safe.discountPercent = Math.max(0, discountPercent);
      return safe;
    });

    return NextResponse.json({
      success: true,
      count: safeVouchers.length,
      vouchers: safeVouchers,
    });
  } catch (error: any) {
    console.error("[Vouchers GET API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch vouchers." }, { status: 500 });
  }
}
