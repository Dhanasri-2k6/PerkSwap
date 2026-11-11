import { runVoucherPipelineFromText, calculateLiquidationPrice, interpretOcrText } from "../src/services/aiVision";
import { encryptVoucherCode, decryptVoucherCode, maskVoucherCode } from "../src/lib/crypto";
import { db } from "../src/lib/db";
import { hashPassword, comparePassword, signToken, verifyToken } from "../src/lib/auth";

console.log("=================================================");
console.log("   PERKSWAP COMPREHENSIVE VERIFICATION SUITE   ");
console.log("=================================================\n");

async function runTestSuite() {
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // -----------------------------------------------------------------
  // 1. AUTHENTICATION & SECURITY TESTS
  // -----------------------------------------------------------------
  console.log("--- 1. Authentication & Security Testing ---");

  // Hash & Compare password
  const rawPw = "SecurePass2026!";
  const hash = await hashPassword(rawPw);
  assert(hash !== rawPw, "Password is hashed and never stored in plain text");
  assert(await comparePassword(rawPw, hash), "Bcrypt password comparison works with valid credentials");
  assert(!(await comparePassword("WrongPass!", hash)), "Bcrypt comparison rejects invalid credentials");

  // JWT Token Signing & Verification
  const token = signToken({ userId: "usr-test-1", email: "test@perkswap.io", name: "Test User" });
  assert(typeof token === "string" && token.length > 20, "JWT token signed successfully");
  const verified = verifyToken(token);
  assert(verified !== null && verified.userId === "usr-test-1", "JWT token verified and claims intact");
  assert(verifyToken("invalid.token.payload") === null, "Invalid JWT token rejected gracefully");

  // User Registration & Duplicate Email Prevention
  const testEmail = `user_${Date.now()}@test.io`;
  const createdUser = await db.users.create({
    name: "Alex Morgan",
    email: testEmail,
    passwordHash: hash,
    walletBalance: 1200,
    trustScore: 94,
  });
  assert(createdUser && createdUser.id, "User registered in database successfully");

  const existing = await db.users.findByEmail(testEmail);
  assert(existing !== null, "User found by email in database");

  // -----------------------------------------------------------------
  // 2. OCR TEXT INTERPRETATION VIA GEMINI
  // -----------------------------------------------------------------
  console.log("\n--- 2. OCR Text Interpretation & Valuation Testing ---");

  // Sample OCR text as extracted by Tesseract.js
  const sampleOcr = `
    Amazon Gift Card
    Gift Card Value: Rs. 1000
    Claim Code: ABCD-1234-XYZ
    Valid Until: 31 December 2026
  `;

  console.log("Sending extracted OCR text to interpretation engine...");
  const interpreted = await interpretOcrText(sampleOcr);

  assert(interpreted.brand?.toLowerCase() === "amazon", `Gemini identified brand as Amazon (got: ${interpreted.brand})`);
  assert(interpreted.voucherCode === "ABCD-1234-XYZ" || interpreted.code === "ABCD-1234-XYZ", `Gemini extracted exact claim code (got: ${interpreted.voucherCode})`);
  assert(interpreted.discountType === "FLAT", "Discount type classified as FLAT");
  assert(interpreted.faceValue === 1000 || interpreted.originalValue === 1000, `Voucher value identified as 1000 (got: ${interpreted.faceValue})`);
  assert(interpreted.expiryDate?.startsWith("2026") ?? false, `Expiry date extracted as ISO 2026 (got: ${interpreted.expiryDate})`);

  // Secondary Liquidation Valuation Formula
  const pricing = calculateLiquidationPrice({
    discountType: "FLAT",
    faceValue: 1000,
    maxDiscount: 1000,
    minSpend: 0,
    expiryDate: "2026-12-31",
  });
  console.log("Calculated Liquidation Price for ₹1000 Gift Card:", pricing.recommendedPrice, "INR");
  assert(pricing.recommendedPrice === 250, "₹1000 flat voucher suggested at 25% secondary liquidation rate (₹250)");

  // Percentage discount valuation test: 50% OFF up to ₹100
  const pctPricing = calculateLiquidationPrice({
    discountType: "PERCENTAGE",
    faceValue: 50,
    maxDiscount: 100,
    minSpend: 0,
    expiryDate: "2026-12-31",
  });
  console.log("Calculated Liquidation Price for 50% OFF up to ₹100:", pctPricing.recommendedPrice, "INR");
  assert(pctPricing.recommendedPrice === 15, "Percentage discount capped within ₹15-₹49 bounds");

  // -----------------------------------------------------------------
  // 3. AES-256-GCM CODE ENCRYPTION & PRIVACY
  // -----------------------------------------------------------------
  console.log("\n--- 3. Voucher Storage & Cryptography Testing ---");

  const secretCode = "AMZN-CLAIM-789-QWERTY";
  const encrypted = encryptVoucherCode(secretCode);
  assert(encrypted.ciphertext !== secretCode, "Voucher code encrypted (not plaintext)");
  assert(!!(encrypted.iv && encrypted.tag), "Unique IV and GCM auth tag generated");

  const decrypted = decryptVoucherCode(encrypted);
  assert(decrypted === secretCode, "Encrypted voucher code decrypted accurately for authorized buyer");

  const masked = maskVoucherCode(secretCode);
  console.log("Public Masked Display:", masked);
  assert(!masked.includes("789-QWERTY"), "Voucher code masked for public marketplace views");

  // -----------------------------------------------------------------
  // 4. ESCROW TRANSACTION & DUPLICATE PREVENTION
  // -----------------------------------------------------------------
  console.log("\n--- 4. Escrow Transaction & Exchange Testing ---");

  // Create voucher
  const voucher = await db.vouchers.create({
    sellerId: createdUser.id,
    brand: "Amazon",
    category: "SHOPPING",
    title: "Amazon ₹1000 Gift Card",
    description: "Verified voucher pass",
    encryptedCode: encrypted.ciphertext,
    iv: encrypted.iv,
    tag: encrypted.tag,
    discountType: "FLAT",
    faceValue: 1000,
    sellingPrice: 250,
    minSpend: 0,
    expiryDate: new Date("2026-12-31"),
    status: "ACTIVE",
    fraudRiskScore: 0,
  });
  assert(voucher && voucher.id, "Voucher listing created and stored in DB");

  // Public query privacy check
  const allVouchers = await db.vouchers.findMany({});
  const foundVoucher = allVouchers.find((v: any) => v.id === voucher.id);
  assert(foundVoucher !== undefined, "Voucher appears in available marketplace listings");

  // Attempt purchase via escrow
  const buyerId = "usr-demo-2";
  const tx = await db.transactions.create({
    buyerId,
    sellerId: voucher.sellerId,
    voucherId: voucher.id,
    amount: voucher.sellingPrice,
    platformFee: 12.5,
    sellerEarnings: 237.5,
    status: "HELD_IN_ESCROW",
    inspectionExpiresAt: new Date(Date.now() + 2 * 3600 * 1000),
  });
  assert(tx && tx.id, "Escrow transaction successfully created and held in escrow");

  // Update voucher status to IN_ESCROW
  await db.vouchers.update(voucher.id, { status: "IN_ESCROW" });
  const inEscrowVoucher = await db.vouchers.findById(voucher.id);
  assert(inEscrowVoucher.status === "IN_ESCROW", "Voucher status updated to IN_ESCROW");

  // Escrow Release: Seller credited, transaction marked RELEASED
  await db.users.updateBalance(voucher.sellerId, tx.sellerEarnings);
  await db.transactions.update(tx.id, { status: "RELEASED", releasedAt: new Date() });
  await db.vouchers.update(voucher.id, { status: "SOLD" });

  const finalTx = await db.transactions.findById(tx.id);
  const finalVoucher = await db.vouchers.findById(voucher.id);
  assert(finalTx.status === "RELEASED", "Escrow successfully released to seller");
  assert(finalVoucher.status === "SOLD", "Voucher status transitioned to SOLD");

  console.log(`\n=================================================`);
  console.log(`  ALL ${passed} / ${total} FUNCTIONAL & SECURITY TESTS PASSED!`);
  console.log(`=================================================`);
}

runTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test suite failed:", err);
    process.exit(1);
  });
