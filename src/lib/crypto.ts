import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes standard for GCM

function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.AES_SECRET_KEY ||
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  // If already 64-char hex string (32 bytes), convert from hex directly, else sha256
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export interface EncryptedData {
  ciphertext: string; // Base64
  iv: string;         // Base64
  tag: string;        // Base64
}

/**
 * Encrypts voucher code using AES-256-GCM.
 * Never stores plain text codes in the database.
 */
export function encryptVoucherCode(plainCode: string): EncryptedData {
  if (!plainCode) {
    throw new Error("Plain code is required for encryption");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainCode, "utf8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypts AES-256-GCM encrypted voucher code.
 * Accepts either an object { ciphertext, iv, tag } or 3 separate strings.
 * Only invoked when authorized buyer has locked funds into escrow or completed a trade.
 */
export function decryptVoucherCode(
  ciphertextOrPayload: string | { ciphertext: string; iv: string; tag: string },
  ivBase64?: string,
  tagBase64?: string
): string {
  try {
    let ciphertext: string;
    let ivStr: string;
    let tagStr: string;

    if (typeof ciphertextOrPayload === "object" && ciphertextOrPayload !== null) {
      ciphertext = ciphertextOrPayload.ciphertext;
      ivStr = ciphertextOrPayload.iv;
      tagStr = ciphertextOrPayload.tag;
    } else {
      ciphertext = String(ciphertextOrPayload);
      ivStr = ivBase64 || "";
      tagStr = tagBase64 || "";
    }

    if (!ciphertext || !ivStr || !tagStr) {
      throw new Error("Missing ciphertext, iv, or tag for decryption");
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivStr, "base64");
    const tag = Buffer.from(tagStr, "base64");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("[Crypto Error] Failed to decrypt voucher code:", err);
    throw new Error("Decryption failed. Invalid ciphertext or key integrity check failed.");
  }
}

/**
 * Safely extracts and decrypts the coupon code from a Voucher document/object.
 * Handles both standard schema fields (encryptedCode, iv, tag) and legacy aliases (code, codeIv, codeTag).
 */
export function decryptVoucher(voucher: any): string | null {
  if (!voucher) return null;
  const cipher = voucher.encryptedCode || voucher.code;
  const iv = voucher.iv || voucher.codeIv;
  const tag = voucher.tag || voucher.codeTag;

  if (!cipher || !iv || !tag) return null;

  try {
    return decryptVoucherCode(cipher, iv, tag);
  } catch (err) {
    console.error("[decryptVoucher] Decryption error for voucher:", voucher.id || voucher._id, err);
    return null;
  }
}

/**
 * Masks a voucher code for public view (e.g. "MYNTRA-SUMMER-500" -> "MYNTRA-•••••••-500")
 */
export function maskVoucherCode(code: string): string {
  if (!code || code.length <= 4) return "••••••••";
  const start = code.slice(0, Math.min(3, Math.floor(code.length / 3)));
  const end = code.slice(-Math.min(3, Math.floor(code.length / 3)));
  return `${start}••••••••${end}`;
}

/**
 * Normalizes a coupon/voucher code before hashing and duplicate checks:
 * - Trims leading and trailing whitespace
 * - Removes non-printable / zero-width characters
 * - Converts standard alphanumeric tokens to uppercase for case-insensitive duplicate matching
 * - Preserves structural hyphens and underscores
 */
export function normalizeVoucherCode(code: string): string {
  if (!code) return "";
  return code
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Strip zero-width spaces
    .trim()
    .toUpperCase();
}

/**
 * Generates a deterministic HMAC-SHA-256 hash of the normalized voucher code.
 * Used for database uniqueness enforcement and duplicate detection without
 * exposing or storing the plain code.
 */
export function generateVoucherCodeHash(normalizedCode: string): string {
  if (!normalizedCode) {
    throw new Error("Normalized code is required to compute code hash.");
  }
  const secret =
    process.env.HMAC_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "perkswap_hmac_secret_key_2026";

  return crypto
    .createHmac("sha256", secret)
    .update(normalizedCode)
    .digest("hex");
}
