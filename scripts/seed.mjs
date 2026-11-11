import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const ALGORITHM = "aes-256-gcm";
const secret = process.env.AES_SECRET_KEY || "perkswap_default_aes256_gcm_master_encryption_key_2026";
const key = crypto.createHash("sha256").update(secret).digest();

function encryptCode(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let enc = cipher.update(plain, "utf8", "base64");
  enc += cipher.final("base64");
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

async function main() {
  console.log("Seeding PerkSwap Database...");

  const userA = await prisma.user.upsert({
    where: { email: "aarav@perkswap.io" },
    update: {},
    create: {
      name: "Aarav Sharma",
      email: "aarav@perkswap.io",
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyzaaravhash",
      walletBalance: 2500.0,
      trustScore: 96,
      verified: true,
      completedTrades: 19,
    },
  });

  const userB = await prisma.user.upsert({
    where: { email: "priya@perkswap.io" },
    update: {},
    create: {
      name: "Priya Patel",
      email: "priya@perkswap.io",
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyzpariyahash",
      walletBalance: 1800.0,
      trustScore: 92,
      verified: true,
      completedTrades: 14,
    },
  });

  const swiggy = encryptCode("SWIGGY-FEAST-70");
  await prisma.voucher.create({
    data: {
      sellerId: userA.id,
      brand: "Swiggy",
      category: "FOOD",
      title: "Flat ₹250 Gourmet Dining & Delivery Voucher",
      description: "Flat ₹250 off on orders above ₹499. Valid across all restaurants.",
      code: swiggy.ciphertext,
      codeIv: swiggy.iv,
      codeTag: swiggy.tag,
      faceValue: 250,
      sellingPrice: 160,
      minSpend: 499,
      expiryDate: new Date(Date.now() + 5 * 86400000),
      status: "ACTIVE",
      autoPriceDecay: true,
      priceDecayRate: 0.05,
      fraudScore: 4,
    },
  });

  const myntra = encryptCode("MYNTRA-SUMMER-500");
  await prisma.voucher.create({
    data: {
      sellerId: userB.id,
      brand: "Myntra",
      category: "SHOPPING",
      title: "Flat ₹500 E-Gift Voucher",
      description: "Applicable on footwear, apparel, and fashion accessories.",
      code: myntra.ciphertext,
      codeIv: myntra.iv,
      codeTag: myntra.tag,
      faceValue: 500,
      sellingPrice: 320,
      minSpend: 1499,
      expiryDate: new Date(Date.now() + 2 * 86400000),
      status: "ACTIVE",
      autoPriceDecay: true,
      priceDecayRate: 0.08,
      fraudScore: 6,
    },
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
