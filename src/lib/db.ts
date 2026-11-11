import mongoose from "mongoose";
import connectMongo from "./mongodb";
import { User, IUser } from "../models/User";
import { Voucher, IVoucher } from "../models/Voucher";
import { Transaction, ITransaction } from "../models/Transaction";
import { Dispute, IDispute } from "../models/Dispute";
import { Swap, ISwap } from "../models/Swap";
import { WalletLedger, IWalletLedger } from "../models/WalletLedger";
import { Payment, IPayment } from "../models/Payment";
import {
  encryptVoucherCode,
  decryptVoucherCode,
  decryptVoucher,
  generateVoucherCodeHash,
  normalizeVoucherCode,
} from "./crypto";

// Memory fallback store for offline development
const code1 = encryptVoucherCode("SWIGGY-FEAST-70");
const code2 = encryptVoucherCode("MYNTRA-SUMMER-500");
const code3 = encryptVoucherCode("UBER-AIRPORT-300");
const code4 = encryptVoucherCode("BMS-WEEKEND-400");
const code5 = encryptVoucherCode("APPL-GIFTCARD-1000");

const hash1 = generateVoucherCodeHash(normalizeVoucherCode("SWIGGY-FEAST-70"));
const hash2 = generateVoucherCodeHash(normalizeVoucherCode("MYNTRA-SUMMER-500"));
const hash3 = generateVoucherCodeHash(normalizeVoucherCode("UBER-AIRPORT-300"));
const hash4 = generateVoucherCodeHash(normalizeVoucherCode("BMS-WEEKEND-400"));
const hash5 = generateVoucherCodeHash(normalizeVoucherCode("APPL-GIFTCARD-1000"));

const memoryUsers: any[] = [
  {
    id: "usr-demo-1",
    _id: "usr-demo-1",
    name: "Aarav Sharma",
    email: "aarav@perkswap.io",
    passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyzaaravhash",
    walletBalance: 2450.0,
    trustScore: 96,
    verified: true,
    completedTrades: 19,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
  },
  {
    id: "usr-demo-2",
    _id: "usr-demo-2",
    name: "Priya Patel",
    email: "priya@perkswap.io",
    passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyzpariyahash",
    walletBalance: 1800.0,
    trustScore: 92,
    verified: true,
    completedTrades: 14,
    createdAt: new Date("2026-02-10"),
    updatedAt: new Date("2026-02-10"),
  },
];

const memoryVouchers: any[] = [
  {
    id: "vch-demo-1",
    _id: "vch-demo-1",
    sellerId: "usr-demo-1",
    brand: "Swiggy",
    category: "FOOD",
    title: "Flat ₹250 OFF",
    description: "Flat ₹250 off on orders above ₹499. Valid on all restaurants.",
    encryptedCode: code1.ciphertext,
    code: code1.ciphertext,
    iv: code1.iv,
    tag: code1.tag,
    codeHash: hash1,
    verificationStatus: "UNVERIFIED",
    reviewFlags: [],
    discountType: "FLAT",
    faceValue: 250,
    sellingPrice: 70, // 28% secondary liquidation
    minSpend: 499,
    expiryDate: new Date(Date.now() + 5 * 86400000),
    status: "ACTIVE",
    fraudRiskScore: 3,
    termsAndConditions: ["Valid on all restaurants", "One-time use per account"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "vch-demo-2",
    _id: "vch-demo-2",
    sellerId: "usr-demo-2",
    brand: "Myntra",
    category: "SHOPPING",
    title: "Flat ₹500 OFF",
    description: "Applicable on footwear, apparel, and fashion accessories.",
    encryptedCode: code2.ciphertext,
    code: code2.ciphertext,
    iv: code2.iv,
    tag: code2.tag,
    codeHash: hash2,
    verificationStatus: "UNVERIFIED",
    reviewFlags: [],
    discountType: "FLAT",
    faceValue: 500,
    sellingPrice: 125, // 25% secondary liquidation
    minSpend: 1499,
    expiryDate: new Date(Date.now() + 2 * 86400000),
    status: "ACTIVE",
    fraudRiskScore: 5,
    termsAndConditions: ["Applicable on top brands", "Combine with card deals"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "vch-demo-3",
    _id: "vch-demo-3",
    sellerId: "usr-demo-1",
    brand: "Uber",
    category: "TRAVEL",
    title: "Flat ₹300 Ride Pass",
    description: "Transferable ride pass with no surge pricing surcharge.",
    encryptedCode: code3.ciphertext,
    code: code3.ciphertext,
    iv: code3.iv,
    tag: code3.tag,
    codeHash: hash3,
    verificationStatus: "UNVERIFIED",
    reviewFlags: [],
    discountType: "FLAT",
    faceValue: 300,
    sellingPrice: 75, // 25% secondary liquidation
    minSpend: 0,
    expiryDate: new Date(Date.now() + 10 * 86400000),
    status: "ACTIVE",
    fraudRiskScore: 2,
    termsAndConditions: ["Valid on Premier & XL trips"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "vch-demo-4",
    _id: "vch-demo-4",
    sellerId: "usr-demo-2",
    brand: "BookMyShow",
    category: "ENTERTAINMENT",
    title: "Flat ₹250 Cinema Pass",
    description: "Digital booking voucher valid for weekend IMAX screenings.",
    encryptedCode: code4.ciphertext,
    code: code4.ciphertext,
    iv: code4.iv,
    tag: code4.tag,
    codeHash: hash4,
    verificationStatus: "UNVERIFIED",
    reviewFlags: [],
    discountType: "FLAT",
    faceValue: 250,
    sellingPrice: 65, // 26% secondary liquidation
    minSpend: 500,
    expiryDate: new Date(Date.now() + 1 * 86400000),
    status: "ACTIVE",
    fraudRiskScore: 6,
    termsAndConditions: ["Valid on all cinema formats"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const memoryTransactions: any[] = [];
const memorySwaps: any[] = [];
const memoryDisputes: any[] = [];
const memoryLedgers: any[] = [];
const memoryPayments: any[] = [];

export const db = {
  users: {
    async findById(id: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const doc = await User.findById(id).lean();
          if (doc) return { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }
      const u = memoryUsers.find((user) => user.id === id || user._id === id);
      return u ? { ...u, id: u.id || u._id } : null;
    },

    async findByEmail(email: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const doc = await User.findOne({ email: email.toLowerCase() }).lean();
          if (doc) return { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }
      const u = memoryUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
      return u ? { ...u, id: u.id || u._id } : null;
    },

    async create(data: any) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const created = await User.create(data);
          const doc = created.toObject();
          return { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }
      const newUser = {
        id: "usr-" + Math.random().toString(36).substring(2, 9),
        walletBalance: data.walletBalance !== undefined ? data.walletBalance : 150.0,
        hasReceivedStarterGrant: data.hasReceivedStarterGrant !== undefined ? data.hasReceivedStarterGrant : true,
        trustScore: 85,
        verified: true,
        completedTrades: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      newUser._id = newUser.id;
      memoryUsers.push(newUser);
      return newUser;
    },

    async updateBalance(id: string, delta: number) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updated = await User.findByIdAndUpdate(
            id,
            { $inc: { walletBalance: delta } },
            { new: true }
          ).lean();
          if (updated) return { ...updated, id: updated._id.toString() };
        } catch { /* fallback */ }
      }
      const user = memoryUsers.find((u) => u.id === id || u._id === id);
      if (user) {
        user.walletBalance = Math.round((user.walletBalance + delta) * 100) / 100;
        user.updatedAt = new Date();
      }
      return user ? { ...user, id: user.id || user._id } : null;
    },

    async updatePassword(id: string, passwordHash: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updated = await User.findByIdAndUpdate(
            id,
            { $set: { passwordHash } },
            { new: true }
          ).lean();
          if (updated) return { ...updated, id: updated._id.toString() };
        } catch { /* fallback */ }
      }
      const user = memoryUsers.find((u) => u.id === id || u._id === id);
      if (user) {
        user.passwordHash = passwordHash;
        user.updatedAt = new Date();
      }
      return user ? { ...user, id: user.id || user._id } : null;
    },

    async updateProfile(id: string, data: { name?: string }) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updated = await User.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true }
          ).lean();
          if (updated) return { ...updated, id: updated._id.toString() };
        } catch { /* fallback */ }
      }
      const user = memoryUsers.find((u) => u.id === id || u._id === id);
      if (user) {
        if (data.name) user.name = data.name;
        user.updatedAt = new Date();
      }
      return user ? { ...user, id: user.id || user._id } : null;
    },
  },

  vouchers: {
    async findMany(filters: any = {}) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const query: any = {};
          if (filters.status) query.status = filters.status;
          if (filters.brand) query.brand = new RegExp(filters.brand, "i");
          if (filters.category && filters.category !== "ALL") query.category = filters.category;

          const docs = await Voucher.find(query).sort({ createdAt: -1 }).lean();
          if (docs && docs.length > 0) {
            return docs.map((d: any) => {
              const seller = memoryUsers.find((u) => String(u._id) === String(d.sellerId)) || {
                name: "Verified Seller",
                trustScore: 92,
                verified: true,
              };
              return {
                ...d,
                id: d._id.toString(),
                seller: {
                  id: String(d.sellerId),
                  name: seller.name,
                  trustScore: seller.trustScore,
                  verified: seller.verified,
                },
              };
            });
          }
        } catch { /* fallback */ }
      }

      let result = [...memoryVouchers];
      if (filters.status) result = result.filter((v) => v.status === filters.status);
      if (filters.brand) result = result.filter((v) => v.brand.toLowerCase().includes(filters.brand.toLowerCase()));
      if (filters.category && filters.category !== "ALL") result = result.filter((v) => v.category === filters.category);

      return result.map((v) => {
        const seller = memoryUsers.find((u) => u.id === v.sellerId || u._id === v.sellerId);
        return {
          ...v,
          id: v.id || v._id,
          seller: seller
            ? { id: seller.id || seller._id, name: seller.name, trustScore: seller.trustScore, verified: seller.verified }
            : { id: v.sellerId, name: "Verified Member", trustScore: 92, verified: true },
        };
      });
    },

    async findById(id: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const d = await Voucher.findById(id).lean();
          if (d) {
            const seller = memoryUsers.find((u) => String(u._id) === String(d.sellerId)) || {
              name: "Verified Member",
              trustScore: 92,
              verified: true,
              completedTrades: 10,
            };
            return {
              ...d,
              id: d._id.toString(),
              seller: {
                id: String(d.sellerId),
                name: seller.name,
                trustScore: seller.trustScore,
                verified: seller.verified,
                completedTrades: seller.completedTrades || 10,
              },
            };
          }
        } catch { /* fallback */ }
      }

      const v = memoryVouchers.find((item) => item.id === id || item._id === id);
      if (!v) return null;
      const seller = memoryUsers.find((u) => u.id === v.sellerId || u._id === v.sellerId);
      return {
        ...v,
        id: v.id || v._id,
        seller: seller
          ? { id: seller.id || seller._id, name: seller.name, trustScore: seller.trustScore, verified: seller.verified, completedTrades: seller.completedTrades }
          : { id: v.sellerId, name: "Verified Member", trustScore: 92, verified: true, completedTrades: 8 },
      };
    },

    async create(data: any) {
      const voucherData = {
        originalSellerId: data.originalSellerId || data.sellerId,
        acquisitionSource: data.acquisitionSource || "UPLOAD",
        acquiredAt: data.acquiredAt || new Date(),
        ...data,
      };
      const conn = await connectMongo();
      if (conn) {
        try {
          const created = await Voucher.create(voucherData);
          const doc = created.toObject();
          return { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }

      const newVoucher = {
        id: "vch-" + Math.random().toString(36).substring(2, 9),
        _id: "vch-" + Math.random().toString(36).substring(2, 9),
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...voucherData,
      };
      memoryVouchers.unshift(newVoucher);
      return { ...newVoucher, id: newVoucher.id };
    },

    async update(id: string, data: any) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updated = await Voucher.findByIdAndUpdate(id, data, { new: true }).lean();
          if (updated) return { ...updated, id: updated._id.toString() };
        } catch { /* fallback */ }
      }

      const v = memoryVouchers.find((item) => item.id === id || item._id === id);
      if (v) {
        Object.assign(v, data);
        v.updatedAt = new Date();
      }
      return v ? { ...v, id: v.id || v._id } : null;
    },

    async findByCodeHash(codeHash: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const doc = await Voucher.findOne({ codeHash }).lean();
          if (doc) return { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }
      const v = memoryVouchers.find((item) => item.codeHash === codeHash);
      return v ? { ...v, id: v.id || v._id } : null;
    },

    async lockForEscrow(voucherId: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const locked = await Voucher.findOneAndUpdate(
            { _id: voucherId, status: "ACTIVE" },
            { $set: { status: "IN_ESCROW" } },
            { returnDocument: "after" }
          ).lean();
          if (locked) return { ...locked, id: locked._id.toString() };
          return null;
        } catch { /* fallback */ }
      }
      const v = memoryVouchers.find(
        (item) => (item.id === voucherId || item._id === voucherId) && item.status === "ACTIVE"
      );
      if (!v) return null;
      v.status = "IN_ESCROW";
      v.updatedAt = new Date();
      return { ...v, id: v.id || v._id };
    },

    async releaseLock(voucherId: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const unlocked = await Voucher.findOneAndUpdate(
            { _id: voucherId, status: "IN_ESCROW" },
            { $set: { status: "ACTIVE" } },
            { returnDocument: "after" }
          ).lean();
          if (unlocked) return { ...unlocked, id: unlocked._id.toString() };
        } catch { /* fallback */ }
      }
      const v = memoryVouchers.find(
        (item) => (item.id === voucherId || item._id === voucherId) && item.status === "IN_ESCROW"
      );
      if (v) {
        v.status = "ACTIVE";
        v.updatedAt = new Date();
        return { ...v, id: v.id || v._id };
      }
      return null;
    },

    async delete(id: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          await Voucher.findByIdAndDelete(id);
          return true;
        } catch { /* fallback */ }
      }
      const idx = memoryVouchers.findIndex((item) => item.id === id || item._id === id);
      if (idx !== -1) {
        memoryVouchers.splice(idx, 1);
        return true;
      }
      return false;
    },
  },

  transactions: {
    async findById(id: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const t = await Transaction.findById(id).lean();
          if (t) {
            const voucher = await db.vouchers.findById(String(t.voucherId));
            const buyer = await db.users.findById(String(t.buyerId));
            const seller = await db.users.findById(String(t.sellerId));
            return { ...t, id: t._id.toString(), voucher, buyer, seller };
          }
        } catch { /* fallback */ }
      }

      const tx = memoryTransactions.find((t) => t.id === id || t._id === id);
      if (!tx) return null;
      const voucher = memoryVouchers.find((v) => v.id === tx.voucherId || v._id === tx.voucherId);
      const buyer = memoryUsers.find((u) => u.id === tx.buyerId || u._id === tx.buyerId);
      const seller = memoryUsers.find((u) => u.id === tx.sellerId || u._id === tx.sellerId);
      return { ...tx, id: tx.id || tx._id, voucher, buyer, seller };
    },

    async findByVoucherId(voucherId: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const t = await Transaction.findOne({ voucherId }).sort({ createdAt: -1 }).lean();
          if (t) return { ...t, id: t._id.toString() };
        } catch { /* fallback */ }
      }
      const tx = memoryTransactions.find((t) => String(t.voucherId) === String(voucherId));
      return tx ? { ...tx, id: tx.id || tx._id } : null;
    },

    async findByUserId(userId: string) {
      const uStr = String(userId);
      const conn = await connectMongo();
      if (conn) {
        try {
          const docs = await Transaction.find({
            $or: [{ buyerId: uStr }, { sellerId: uStr }],
          })
            .sort({ createdAt: -1 })
            .lean();
          if (docs && docs.length > 0) {
            return docs.map((t: any) => ({ ...t, id: t._id.toString() }));
          }
        } catch { /* fallback */ }
      }
      return memoryTransactions.filter(
        (t) => String(t.buyerId) === uStr || String(t.sellerId) === uStr
      );
    },

    async create(data: any) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const created = await Transaction.create(data);
          const doc = created.toObject();
          return { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }

      const newTx = {
        id: "tx-" + Math.random().toString(36).substring(2, 9),
        _id: "tx-" + Math.random().toString(36).substring(2, 9),
        status: "HELD_IN_ESCROW",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      memoryTransactions.unshift(newTx);
      return { ...newTx, id: newTx.id };
    },

    async update(id: string, data: any) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updated = await Transaction.findByIdAndUpdate(id, data, { returnDocument: "after" }).lean();
          if (updated) return { ...updated, id: updated._id.toString() };
        } catch { /* fallback */ }
      }

      const tx = memoryTransactions.find((t) => t.id === id || t._id === id);
      if (tx) {
        Object.assign(tx, data);
        tx.updatedAt = new Date();
      }
      return tx ? { ...tx, id: tx.id || tx._id } : null;
    },

    async releaseEscrow(transactionId: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updated = await Transaction.findOneAndUpdate(
            { _id: transactionId, status: "HELD_IN_ESCROW" },
            { $set: { status: "RELEASED", releasedAt: new Date() } },
            { returnDocument: "after" }
          ).lean();
          if (updated) return { ...updated, id: updated._id.toString() };
          return null;
        } catch { /* fallback */ }
      }

      const tx = memoryTransactions.find(
        (t) => (t.id === transactionId || t._id === transactionId) && t.status === "HELD_IN_ESCROW"
      );
      if (!tx) return null;
      tx.status = "RELEASED";
      tx.releasedAt = new Date();
      tx.updatedAt = new Date();
      return { ...tx, id: tx.id || tx._id };
    },

    async refundEscrow(transactionId: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updated = await Transaction.findOneAndUpdate(
            { _id: transactionId, status: { $in: ["HELD_IN_ESCROW", "DISPUTED"] } },
            { $set: { status: "REFUNDED", refundedAt: new Date() } },
            { returnDocument: "after" }
          ).lean();
          if (updated) return { ...updated, id: updated._id.toString() };
          return null;
        } catch { /* fallback */ }
      }

      const tx = memoryTransactions.find(
        (t) =>
          (t.id === transactionId || t._id === transactionId) &&
          (t.status === "HELD_IN_ESCROW" || t.status === "DISPUTED")
      );
      if (!tx) return null;
      tx.status = "REFUNDED";
      tx.refundedAt = new Date();
      tx.updatedAt = new Date();
      return { ...tx, id: tx.id || tx._id };
    },
  },

  swaps: {
    async create(data: any) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const created = await Swap.create({
            ...data,
            requesterId: String(data.requesterId),
            requestedId: String(data.requestedId),
            offeredVoucherId: String(data.offeredVoucherId),
            targetVoucherId: String(data.targetVoucherId),
          });
          const doc = created.toObject();
          return { ...doc, id: doc._id.toString() };
        } catch { /* fallback to memory */ }
      }

      const newSwap = {
        id: "swap-" + Math.random().toString(36).substring(2, 9),
        _id: "swap-" + Math.random().toString(36).substring(2, 9),
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
        requesterId: String(data.requesterId),
        requestedId: String(data.requestedId),
        offeredVoucherId: String(data.offeredVoucherId),
        targetVoucherId: String(data.targetVoucherId),
      };
      memorySwaps.unshift(newSwap);
      return { ...newSwap, id: newSwap.id };
    },

    async findById(id: string) {
      let swap: any = null;
      const conn = await connectMongo();
      if (conn) {
        try {
          const doc = await Swap.findById(id).lean();
          if (doc) swap = { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }
      if (!swap) {
        swap = memorySwaps.find((s) => s.id === id || s._id === id);
      }
      if (!swap) return null;

      const offered = await db.vouchers.findById(String(swap.offeredVoucherId));
      const target = await db.vouchers.findById(String(swap.targetVoucherId));
      const requester = await db.users.findById(String(swap.requesterId));
      const requested = await db.users.findById(String(swap.requestedId));
      return {
        ...swap,
        id: swap.id || swap._id,
        offeredVoucher: offered,
        targetVoucher: target,
        requester: requester
          ? { id: requester.id, name: requester.name, trustScore: requester.trustScore }
          : { name: "Community Member", trustScore: 90 },
        requested: requested
          ? { id: requested.id, name: requested.name, trustScore: requested.trustScore }
          : { name: "Voucher Owner", trustScore: 90 },
      };
    },

    async findUserSwaps(userId: string) {
      const uIdStr = String(userId);
      let swapsList: any[] = [];
      const conn = await connectMongo();
      if (conn) {
        try {
          const docs = await Swap.find({
            $or: [{ requesterId: uIdStr }, { requestedId: uIdStr }],
          })
            .sort({ createdAt: -1 })
            .lean();
          if (docs && docs.length > 0) {
            swapsList = docs.map((d: any) => ({ ...d, id: d._id.toString() }));
          }
        } catch { /* fallback */ }
      }

      if (swapsList.length === 0) {
        swapsList = memorySwaps.filter(
          (s) => String(s.requesterId) === uIdStr || String(s.requestedId) === uIdStr
        );
      }

      const enriched = await Promise.all(
        swapsList.map(async (swap) => {
          const offered = await db.vouchers.findById(String(swap.offeredVoucherId));
          const target = await db.vouchers.findById(String(swap.targetVoucherId));
          const requester = await db.users.findById(String(swap.requesterId));
          const requested = await db.users.findById(swap.requestedId ? String(swap.requestedId) : "");

          const isRequester = String(swap.requesterId) === uIdStr;
          const isRequested = String(swap.requestedId) === uIdStr;

          // Determine what this user received and what they gave away
          // Requester (Alice) gave away offeredVoucher and received targetVoucher
          // Requested (Bob) gave away targetVoucher and received offeredVoucher
          const receivedVoucher = isRequester ? target : offered;
          const transferredVoucher = isRequester ? offered : target;

          let receivedCode: string | null = null;
          if (swap.status === "ACCEPTED") {
            if (isRequester) {
              receivedCode = swap.revealedTargetCode || (target ? decryptVoucher(target) : null);
            } else if (isRequested) {
              receivedCode = swap.revealedOfferedCode || (offered ? decryptVoucher(offered) : null);
            }
          }

          // Clean public representations
          const cleanVoucher = (v: any) => {
            if (!v) return null;
            const safe = { ...v };
            delete safe.encryptedCode;
            delete safe.iv;
            delete safe.tag;
            delete safe.codeIv;
            delete safe.codeTag;
            delete safe.codeHash;
            return safe;
          };

          return {
            ...swap,
            id: swap.id || swap._id,
            offeredVoucher: cleanVoucher(offered),
            targetVoucher: cleanVoucher(target),
            receivedVoucher: cleanVoucher(receivedVoucher),
            transferredVoucher: cleanVoucher(transferredVoucher),
            receivedCode,
            isRequester,
            isRequested,
            requester: requester
              ? { id: requester.id, name: requester.name, trustScore: requester.trustScore }
              : { name: "Community Member", trustScore: 90 },
            requested: requested
              ? { id: requested.id, name: requested.name, trustScore: requested.trustScore }
              : { name: "Voucher Owner", trustScore: 90 },
          };
        })
      );
      return enriched;
    },

    async executeSwap(swapRequestId: string, requestedUserId: string) {
      const swap = await db.swaps.findById(swapRequestId);
      if (!swap) {
        return { success: false, error: "Swap proposal not found." };
      }

      if (String(swap.requestedId) !== String(requestedUserId)) {
        return {
          success: false,
          error: "Forbidden: Only the owner of the target voucher can accept this swap proposal.",
        };
      }

      if (swap.status !== "PENDING") {
        return {
          success: false,
          error: `Swap proposal is already ${swap.status}. Cannot accept again.`,
        };
      }

      const offered = await db.vouchers.findById(String(swap.offeredVoucherId));
      const target = await db.vouchers.findById(String(swap.targetVoucherId));

      if (!offered || !target) {
        return { success: false, error: "One or both vouchers are no longer available in the marketplace." };
      }

      // Verify current ownership matches proposal
      if (String(offered.sellerId) !== String(swap.requesterId)) {
        return {
          success: false,
          error: "The offered voucher is no longer owned by the user who proposed the trade.",
        };
      }
      if (String(target.sellerId) !== String(swap.requestedId)) {
        return {
          success: false,
          error: "You are no longer the owner of the target voucher.",
        };
      }

      // Verify active status
      if (offered.status !== "ACTIVE" || target.status !== "ACTIVE") {
        return {
          success: false,
          error: `Both vouchers must be in ACTIVE status. Current statuses: offered=${offered.status}, target=${target.status}.`,
        };
      }

      // Verify future expiry
      const now = Date.now();
      if (new Date(offered.expiryDate).getTime() <= now) {
        return { success: false, error: "The offered voucher has expired and cannot be traded." };
      }
      if (new Date(target.expiryDate).getTime() <= now) {
        return { success: false, error: "Your target voucher has expired and cannot be traded." };
      }

      // Decrypt the ACTUAL claim codes
      const plainOfferedCode = decryptVoucher(offered);
      const plainTargetCode = decryptVoucher(target);

      if (!plainOfferedCode || !plainTargetCode) {
        return {
          success: false,
          error: "Failed to decrypt actual voucher codes. Exchange aborted to prevent asset loss.",
        };
      }

      // 1. Atomically lock swap state to ACCEPTED with codes
      const conn = await connectMongo();
      let updatedSwap: any = null;

      if (conn) {
        try {
          updatedSwap = await Swap.findOneAndUpdate(
            { _id: swapRequestId, status: "PENDING" },
            {
              $set: {
                status: "ACCEPTED",
                revealedOfferedCode: plainOfferedCode,
                revealedTargetCode: plainTargetCode,
                completedAt: new Date(),
              },
            },
            { returnDocument: "after" }
          ).lean();
        } catch (err) {
          console.error("[MongoDB executeSwap] Swap update error:", err);
        }
      }

      if (!updatedSwap) {
        const memSwap = memorySwaps.find(
          (s) => (s.id === swapRequestId || s._id === swapRequestId) && s.status === "PENDING"
        );
        if (memSwap) {
          memSwap.status = "ACCEPTED";
          memSwap.revealedOfferedCode = plainOfferedCode;
          memSwap.revealedTargetCode = plainTargetCode;
          memSwap.completedAt = new Date();
          memSwap.updatedAt = new Date();
          updatedSwap = { ...memSwap, id: memSwap.id || memSwap._id };
        }
      }

      if (!updatedSwap) {
        return {
          success: false,
          error: "Swap proposal is no longer pending or was already accepted concurrently.",
        };
      }

      // 2. Exchange ownership of both vouchers and mark as SWAPPED
      try {
        await Promise.all([
          db.vouchers.update(String(swap.offeredVoucherId), {
            sellerId: String(swap.requestedId),
            status: "SWAPPED",
            acquisitionSource: "SWAP",
            acquiredAt: new Date(),
          }),
          db.vouchers.update(String(swap.targetVoucherId), {
            sellerId: String(swap.requesterId),
            status: "SWAPPED",
            acquisitionSource: "SWAP",
            acquiredAt: new Date(),
          }),
        ]);
      } catch (transferErr: any) {
        // Rollback swap status on unexpected failure
        await db.swaps.update(swapRequestId, { status: "PENDING" });
        return {
          success: false,
          error: "Failed to transfer voucher ownership: " + transferErr.message,
        };
      }

      return {
        success: true,
        swapId: swapRequestId,
        revealedOfferedCode: plainOfferedCode,
        revealedTargetCode: plainTargetCode,
        // The user who accepted is the requested user (Bob) - they receive Coupon A
        receivedCode: plainOfferedCode,
        receivedVoucher: offered,
        transferredVoucher: target,
      };
    },

    async update(id: string, data: any) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updated = await Swap.findByIdAndUpdate(id, data, { returnDocument: "after" }).lean();
          if (updated) return { ...updated, id: updated._id.toString() };
        } catch { /* fallback */ }
      }

      const swap = memorySwaps.find((s) => s.id === id || s._id === id);
      if (swap) {
        Object.assign(swap, data);
        swap.updatedAt = new Date();
      }
      return swap ? { ...swap, id: swap.id || swap._id } : null;
    },
  },

  disputes: {
    async create(data: any) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const created = await Dispute.create(data);
          const doc = created.toObject();
          return { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }

      const newDispute = {
        id: "dsp-" + Math.random().toString(36).substring(2, 9),
        _id: "dsp-" + Math.random().toString(36).substring(2, 9),
        status: "OPEN",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      memoryDisputes.unshift(newDispute);
      return { ...newDispute, id: newDispute.id };
    },

    async findById(id: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const doc = await Dispute.findById(id).lean();
          if (doc) return { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }
      const d = memoryDisputes.find((item) => item.id === id || item._id === id);
      return d ? { ...d, id: d.id || d._id } : null;
    },

    async findMany(filters: any = {}) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const docs = await Dispute.find(filters).sort({ createdAt: -1 }).lean();
          return docs.map((d: any) => ({ ...d, id: d._id.toString() }));
        } catch { /* fallback */ }
      }
      return memoryDisputes.filter((d) => {
        for (const key of Object.keys(filters)) {
          if ((d as any)[key] !== filters[key]) return false;
        }
        return true;
      });
    },

    async findByTransactionId(transactionId: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const doc = await Dispute.findOne({ transactionId }).lean();
          if (doc) return { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }
      const d = memoryDisputes.find((item) => item.transactionId === transactionId);
      return d ? { ...d, id: d.id || d._id } : null;
    },

    async update(id: string, data: any) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updated = await Dispute.findByIdAndUpdate(id, data, { returnDocument: "after" }).lean();
          if (updated) return { ...updated, id: updated._id.toString() };
        } catch { /* fallback */ }
      }
      const d = memoryDisputes.find((item) => item.id === id || item._id === id);
      if (d) {
        Object.assign(d, data);
        d.updatedAt = new Date();
      }
      return d ? { ...d, id: d.id || d._id } : null;
    },
  },

  walletLedger: {
    async record(data: {
      userId: string;
      type:
        | "STARTER_GRANT"
        | "PACKAGE_PURCHASE"
        | "ESCROW_LOCK"
        | "ESCROW_RELEASE"
        | "ESCROW_REFUND"
        | "DIRECT_TRANSFER";
      amount: number;
      balanceAfter: number;
      description: string;
      referenceId?: string;
      metadata?: any;
    }) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const entry = await WalletLedger.create(data);
          const doc = entry.toObject();
          return { ...doc, id: doc._id.toString() };
        } catch { /* fallback */ }
      }
      const entry = {
        id: "ledg-" + Math.random().toString(36).substring(2, 9),
        _id: "ledg-" + Math.random().toString(36).substring(2, 9),
        ...data,
        createdAt: new Date(),
      };
      memoryLedgers.unshift(entry);
      return entry;
    },

    async findByUserId(userId: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const entries = await WalletLedger.find({ userId: String(userId) })
            .sort({ createdAt: -1 })
            .lean();
          return entries.map((e: any) => ({ ...e, id: e._id.toString() }));
        } catch { /* fallback */ }
      }
      return memoryLedgers
        .filter((e) => String(e.userId) === String(userId))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  },

  payments: {
    async create(data: {
      userId: string;
      packageId: string;
      packageTitle: string;
      coins: number;
      bonusCoins: number;
      totalCoins: number;
      razorpayOrderId: string;
      amount: number;
      amountInr: number;
      currency: "INR";
      status?: "created" | "pending" | "captured" | "failed";
      receipt?: string;
      mode?: "test";
    }) {
      const payload = {
        ...data,
        userId: String(data.userId),
        status: data.status || "created",
        razorpaySignatureVerified: false,
        coinsCredited: false,
        processedWebhookEvents: [],
        mode: "test" as const,
      };

      const conn = await connectMongo();
      if (conn) {
        try {
          const created = await Payment.create(payload);
          const doc = created.toObject();
          return { ...doc, id: doc._id.toString() };
        } catch (err: any) {
          // If duplicate razorpayOrderId, rethrow so caller prevents duplicate order creation
          if (err?.code === 11000) throw err;
          /* fallback only when Mongo unavailable */
        }
      }

      const dup = memoryPayments.find((p) => p.razorpayOrderId === payload.razorpayOrderId);
      if (dup) {
        throw new Error(`Duplicate razorpayOrderId: ${payload.razorpayOrderId}`);
      }

      const newPayment = {
        id: "paydoc-" + Math.random().toString(36).substring(2, 9),
        _id: "paydoc-" + Math.random().toString(36).substring(2, 9),
        ...payload,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryPayments.unshift(newPayment);
      return { ...newPayment };
    },

    async findByOrderId(razorpayOrderId: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const doc = await Payment.findOne({ razorpayOrderId }).lean();
          return doc ? { ...doc, id: doc._id.toString() } : null;
        } catch { /* fallback */ }
      }
      const p = memoryPayments.find((item) => item.razorpayOrderId === razorpayOrderId);
      return p ? { ...p, id: p.id || p._id } : null;
    },

    async findByPaymentId(razorpayPaymentId: string) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const doc = await Payment.findOne({ razorpayPaymentId }).lean();
          return doc ? { ...doc, id: doc._id.toString() } : null;
        } catch { /* fallback */ }
      }
      const p = memoryPayments.find((item) => item.razorpayPaymentId === razorpayPaymentId);
      return p ? { ...p, id: p.id || p._id } : null;
    },

    async findByUserId(userId: string) {
      const uStr = String(userId);
      const conn = await connectMongo();
      if (conn) {
        try {
          const docs = await Payment.find({ userId: uStr }).sort({ createdAt: -1 }).lean();
          return docs.map((d: any) => ({ ...d, id: d._id.toString() }));
        } catch { /* fallback */ }
      }
      return memoryPayments
        .filter((item) => String(item.userId) === uStr)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((p) => ({ ...p, id: p.id || p._id }));
    },

    async markPending(
      razorpayOrderId: string,
      updates: {
        razorpayPaymentId?: string;
        paymentMethod?: string;
        signatureVerified?: boolean;
        webhookEventId?: string;
      }
    ) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updateQuery: any = {
            $set: {
              status: "pending",
              ...(updates.razorpayPaymentId ? { razorpayPaymentId: updates.razorpayPaymentId } : {}),
              ...(updates.paymentMethod ? { paymentMethod: updates.paymentMethod } : {}),
              ...(updates.signatureVerified ? { razorpaySignatureVerified: true } : {}),
            },
          };
          if (updates.webhookEventId) {
            updateQuery.$addToSet = { processedWebhookEvents: updates.webhookEventId };
          }
          // Never overwrite already-captured payments back to pending
          const doc = await Payment.findOneAndUpdate(
            { razorpayOrderId, status: { $ne: "captured" }, coinsCredited: false },
            updateQuery,
            { returnDocument: "after" }
          ).lean();
          if (doc) return { ...doc, id: doc._id.toString() };
          const existing = await Payment.findOne({ razorpayOrderId }).lean();
          if (existing && updates.webhookEventId) {
            await Payment.updateOne(
              { razorpayOrderId },
              { $addToSet: { processedWebhookEvents: updates.webhookEventId } }
            );
          }
          return existing ? { ...existing, id: existing._id.toString() } : null;
        } catch { /* fallback */ }
      }

      const mem = memoryPayments.find((item) => item.razorpayOrderId === razorpayOrderId);
      if (mem) {
        if (!mem.coinsCredited && mem.status !== "captured") {
          mem.status = "pending";
          if (updates.razorpayPaymentId) mem.razorpayPaymentId = updates.razorpayPaymentId;
          if (updates.paymentMethod) mem.paymentMethod = updates.paymentMethod;
          if (updates.signatureVerified) mem.razorpaySignatureVerified = true;
          mem.updatedAt = new Date();
        }
        if (updates.webhookEventId && !mem.processedWebhookEvents.includes(updates.webhookEventId)) {
          mem.processedWebhookEvents.push(updates.webhookEventId);
        }
      }
      return mem ? { ...mem, id: mem.id || mem._id } : null;
    },

    async markFailed(
      razorpayOrderId: string,
      updates: {
        razorpayPaymentId?: string;
        paymentMethod?: string;
        failureCode?: string;
        failureReason?: string;
        webhookEventId?: string;
      }
    ) {
      const conn = await connectMongo();
      if (conn) {
        try {
          const updateQuery: any = {
            $set: {
              status: "failed",
              ...(updates.razorpayPaymentId ? { razorpayPaymentId: updates.razorpayPaymentId } : {}),
              ...(updates.paymentMethod ? { paymentMethod: updates.paymentMethod } : {}),
              ...(updates.failureCode ? { failureCode: updates.failureCode } : {}),
              ...(updates.failureReason ? { failureReason: updates.failureReason } : {}),
            },
          };
          if (updates.webhookEventId) {
            updateQuery.$addToSet = { processedWebhookEvents: updates.webhookEventId };
          }
          // Never overwrite an already-captured order with an older failed attempt
          const filter: any = { razorpayOrderId, status: { $ne: "captured" }, coinsCredited: false };
          if (updates.webhookEventId) {
            filter.processedWebhookEvents = { $ne: updates.webhookEventId };
          }
          const doc = await Payment.findOneAndUpdate(filter, updateQuery, {
            returnDocument: "after",
          }).lean();
          if (doc) return { ...doc, id: doc._id.toString() };
          const existing = await Payment.findOne({ razorpayOrderId }).lean();
          if (
            existing &&
            updates.webhookEventId &&
            !(existing.processedWebhookEvents || []).includes(updates.webhookEventId)
          ) {
            await Payment.updateOne(
              { razorpayOrderId },
              { $addToSet: { processedWebhookEvents: updates.webhookEventId } }
            );
          }
          return existing ? { ...existing, id: existing._id.toString() } : null;
        } catch { /* fallback */ }
      }

      const mem = memoryPayments.find((item) => item.razorpayOrderId === razorpayOrderId);
      if (mem) {
        if (!mem.coinsCredited && mem.status !== "captured") {
          mem.status = "failed";
          if (updates.razorpayPaymentId) mem.razorpayPaymentId = updates.razorpayPaymentId;
          if (updates.paymentMethod) mem.paymentMethod = updates.paymentMethod;
          if (updates.failureCode) mem.failureCode = updates.failureCode;
          if (updates.failureReason) mem.failureReason = updates.failureReason;
          mem.updatedAt = new Date();
        }
        if (updates.webhookEventId && !mem.processedWebhookEvents.includes(updates.webhookEventId)) {
          mem.processedWebhookEvents.push(updates.webhookEventId);
        }
      }
      return mem ? { ...mem, id: mem.id || mem._id } : null;
    },

    /**
     * Atomically captures a Razorpay payment and credits coins to the user's wallet + WalletLedger.
     * - Idempotent: prevents double crediting across verify retries, webhook retries, and races.
     * - Uses MongoDB ACID transactions when replica set is available, with conditional atomic fallback
     *   and strict compensating rollback on standalone deployments.
     */
    async creditPaymentIdempotently(params: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      paymentMethod?: string;
      signatureVerified?: boolean;
      webhookEventId?: string;
    }): Promise<{
      success: boolean;
      alreadyCredited: boolean;
      duplicateWebhookEvent?: boolean;
      payment?: any;
      walletBalance?: number;
      error?: string;
    }> {
      const {
        razorpayOrderId,
        razorpayPaymentId,
        paymentMethod,
        signatureVerified,
        webhookEventId,
      } = params;

      const conn = await connectMongo();
      if (conn) {
        const existingInMongo = await Payment.findOne({ razorpayOrderId }).lean();
        if (!existingInMongo) {
          return { success: false, alreadyCredited: false, error: "Payment order not found." };
        }

        if (
          webhookEventId &&
          Array.isArray(existingInMongo.processedWebhookEvents) &&
          existingInMongo.processedWebhookEvents.includes(webhookEventId)
        ) {
          const u = await db.users.findById(String(existingInMongo.userId));
          return {
            success: true,
            alreadyCredited: Boolean(existingInMongo.coinsCredited),
            duplicateWebhookEvent: true,
            payment: { ...existingInMongo, id: existingInMongo._id.toString() },
            walletBalance: u?.walletBalance,
          };
        }

        if (existingInMongo.coinsCredited) {
          if (
            existingInMongo.razorpayPaymentId &&
            existingInMongo.razorpayPaymentId !== razorpayPaymentId
          ) {
            return {
              success: false,
              alreadyCredited: true,
              error: "Order has already been settled under a different payment ID.",
            };
          }
          if (webhookEventId) {
            await Payment.updateOne(
              { razorpayOrderId },
              { $addToSet: { processedWebhookEvents: webhookEventId } }
            );
          }
          const u = await db.users.findById(String(existingInMongo.userId));
          return {
            success: true,
            alreadyCredited: true,
            payment: { ...existingInMongo, id: existingInMongo._id.toString() },
            walletBalance: u?.walletBalance,
          };
        }

        // Defense-in-depth: ensure this razorpayPaymentId wasn't credited on another order
        const otherCredited = await Payment.findOne({
          razorpayPaymentId,
          coinsCredited: true,
        }).lean();
        if (otherCredited && otherCredited.razorpayOrderId !== razorpayOrderId) {
          return {
            success: false,
            alreadyCredited: true,
            error: "This Razorpay payment ID has already been processed.",
          };
        }

        const previousStatus = existingInMongo.status || "created";
        const hadPaymentIdBefore = Boolean(existingInMongo.razorpayPaymentId);

        const buildClaimUpdate = () => {
          const setFields: any = {
            status: "captured",
            razorpayPaymentId,
            coinsCredited: true,
            creditedAt: new Date(),
          };
          if (paymentMethod) setFields.paymentMethod = paymentMethod;
          if (signatureVerified) setFields.razorpaySignatureVerified = true;

          const u: any = {
            $set: setFields,
            $unset: { failureCode: "", failureReason: "" },
          };
          if (webhookEventId) {
            u.$addToSet = { processedWebhookEvents: webhookEventId };
          }
          return u;
        };

        const resolveConcurrentClaimMiss = async (
          session?: mongoose.ClientSession
        ) => {
          const currentQuery = Payment.findOne({ razorpayOrderId });
          if (session) currentQuery.session(session);
          const current = await currentQuery.lean();
          if (!current) {
            return {
              success: false,
              alreadyCredited: false,
              error: "Payment order not found.",
            };
          }

          if (
            current.razorpayPaymentId &&
            current.razorpayPaymentId !== razorpayPaymentId
          ) {
            return {
              success: false,
              alreadyCredited: true,
              error: "Order has already been settled under a different payment ID.",
            };
          }

          const wasDuplicateEvent = Boolean(
            webhookEventId &&
              Array.isArray(current.processedWebhookEvents) &&
              current.processedWebhookEvents.includes(webhookEventId)
          );

          if (webhookEventId && !wasDuplicateEvent) {
            await Payment.updateOne(
              { razorpayOrderId },
              { $addToSet: { processedWebhookEvents: webhookEventId } },
              session ? { session } : undefined
            );
          }

          const userQuery = User.findById(String(current.userId));
          if (session) userQuery.session(session);
          const currentUser = await userQuery.lean();

          return {
            success: true,
            alreadyCredited: Boolean(current.coinsCredited),
            duplicateWebhookEvent: wasDuplicateEvent,
            payment: { ...current, id: current._id.toString() },
            walletBalance: currentUser?.walletBalance,
          };
        };

        // Attempt MongoDB ACID transaction first
        const session = await mongoose.startSession();
        let txResult: any = null;
        let txUnsupported = false;

        try {
          await session.withTransaction(async () => {
            const claimed = await Payment.findOneAndUpdate(
              { razorpayOrderId, coinsCredited: false },
              buildClaimUpdate(),
              { returnDocument: "after", session }
            ).lean();

            if (!claimed) {
              txResult = await resolveConcurrentClaimMiss(session);
              return;
            }

            const existingLedger = await WalletLedger.findOne({
              userId: String(claimed.userId),
              type: "PACKAGE_PURCHASE",
              referenceId: razorpayPaymentId,
            })
              .session(session)
              .lean();

            if (existingLedger) {
              const existingUser = await User.findById(String(claimed.userId))
                .session(session)
                .lean();
              txResult = {
                success: true,
                alreadyCredited: true,
                payment: { ...claimed, id: claimed._id.toString() },
                walletBalance: existingUser?.walletBalance ?? existingLedger.balanceAfter,
              };
              return;
            }

            const updatedUser = await User.findByIdAndUpdate(
              String(claimed.userId),
              { $inc: { walletBalance: claimed.totalCoins } },
              { returnDocument: "after", session }
            ).lean();

            if (!updatedUser) {
              throw new Error("Associated user wallet not found during credit transaction.");
            }

            await WalletLedger.create(
              [
                {
                  userId: String(claimed.userId),
                  type: "PACKAGE_PURCHASE",
                  amount: claimed.totalCoins,
                  balanceAfter: updatedUser.walletBalance,
                  description: `Purchased ${claimed.packageTitle} (+${claimed.totalCoins} coins via Razorpay Test Mode)`,
                  referenceId: razorpayPaymentId,
                  metadata: {
                    gateway: "razorpay",
                    mode: "test",
                    razorpayOrderId,
                    razorpayPaymentId,
                    packageId: claimed.packageId,
                    amountPaise: claimed.amount,
                    amountInr: claimed.amountInr,
                    currency: claimed.currency,
                    coins: claimed.coins,
                    bonusCoins: claimed.bonusCoins,
                    totalCoins: claimed.totalCoins,
                    paymentMethod: paymentMethod || claimed.paymentMethod,
                    status: "captured",
                    timestamp: new Date().toISOString(),
                  },
                },
              ],
              { session }
            );

            txResult = {
              success: true,
              alreadyCredited: false,
              payment: { ...claimed, id: claimed._id.toString() },
              walletBalance: updatedUser.walletBalance,
            };
          });
        } catch (txErr: any) {
          const msg = String(txErr?.message || "");
          if (
            txErr?.code === 20 ||
            txErr?.code === 263 ||
            txErr?.codeName === "IllegalOperation" ||
            /Transaction numbers are only allowed on a replica set/i.test(msg) ||
            /does not support transactions/i.test(msg) ||
            /Transactions are not supported/i.test(msg) ||
            /Sessions are not supported/i.test(msg)
          ) {
            txUnsupported = true;
          } else {
            throw txErr;
          }
        } finally {
          await session.endSession();
        }

        if (!txUnsupported && txResult) {
          return txResult;
        }

        // Fallback for standalone MongoDB without replica set:
        // uses atomic conditional Payment claim + WalletLedger dedup check + full compensating rollback.
        const claimed = await Payment.findOneAndUpdate(
          { razorpayOrderId, coinsCredited: false },
          buildClaimUpdate(),
          { returnDocument: "after" }
        ).lean();

        if (!claimed) {
          return await resolveConcurrentClaimMiss();
        }

        let walletIncremented = false;
        let ledgerCreated = false;

        try {
          const existingLedger = await WalletLedger.findOne({
            userId: String(claimed.userId),
            type: "PACKAGE_PURCHASE",
            referenceId: razorpayPaymentId,
          }).lean();

          if (existingLedger) {
            const existingUser = await User.findById(String(claimed.userId)).lean();
            return {
              success: true,
              alreadyCredited: true,
              payment: { ...claimed, id: claimed._id.toString() },
              walletBalance: existingUser?.walletBalance ?? existingLedger.balanceAfter,
            };
          }

          const updatedUser = await User.findByIdAndUpdate(
            String(claimed.userId),
            { $inc: { walletBalance: claimed.totalCoins } },
            { returnDocument: "after" }
          ).lean();

          if (!updatedUser) {
            throw new Error("Associated user wallet not found.");
          }
          walletIncremented = true;

          await WalletLedger.create({
            userId: String(claimed.userId),
            type: "PACKAGE_PURCHASE",
            amount: claimed.totalCoins,
            balanceAfter: updatedUser.walletBalance,
            description: `Purchased ${claimed.packageTitle} (+${claimed.totalCoins} coins via Razorpay Test Mode)`,
            referenceId: razorpayPaymentId,
            metadata: {
              gateway: "razorpay",
              mode: "test",
              razorpayOrderId,
              razorpayPaymentId,
              packageId: claimed.packageId,
              amountPaise: claimed.amount,
              amountInr: claimed.amountInr,
              currency: claimed.currency,
              coins: claimed.coins,
              bonusCoins: claimed.bonusCoins,
              totalCoins: claimed.totalCoins,
              paymentMethod: paymentMethod || claimed.paymentMethod,
              status: "captured",
              timestamp: new Date().toISOString(),
            },
          });
          ledgerCreated = true;

          return {
            success: true,
            alreadyCredited: false,
            payment: { ...claimed, id: claimed._id.toString() },
            walletBalance: updatedUser.walletBalance,
          };
        } catch (creditErr: any) {
          let safeToReleaseClaim = !walletIncremented;

          if (walletIncremented && !ledgerCreated) {
            try {
              const rollbackUser = await User.updateOne(
                { _id: String(claimed.userId), walletBalance: { $gte: claimed.totalCoins } },
                { $inc: { walletBalance: -claimed.totalCoins } }
              );
              safeToReleaseClaim = rollbackUser.modifiedCount === 1;
            } catch (rollbackErr: any) {
              safeToReleaseClaim = false;
              console.error(
                "[Payment Reconciliation Alert] Standalone wallet rollback failed; keeping coinsCredited=true to prevent double credit.",
                { razorpayOrderId, razorpayPaymentId, error: rollbackErr?.message }
              );
            }
          }

          if (safeToReleaseClaim) {
            const unsetFields: any = { creditedAt: "" };
            if (!hadPaymentIdBefore) {
              unsetFields.razorpayPaymentId = "";
            }
            const revertUpdate: any = {
              $set: { coinsCredited: false, status: previousStatus },
              $unset: unsetFields,
            };
            if (webhookEventId) {
              revertUpdate.$pull = { processedWebhookEvents: webhookEventId };
            }
            await Payment.updateOne({ razorpayOrderId }, revertUpdate);
          }

          throw creditErr;
        }
      }

      // In-memory store fallback
      const mem = memoryPayments.find((item) => item.razorpayOrderId === razorpayOrderId);
      if (!mem) {
        return { success: false, alreadyCredited: false, error: "Payment order not found." };
      }

      if (webhookEventId && mem.processedWebhookEvents.includes(webhookEventId)) {
        const u = await db.users.findById(String(mem.userId));
        return {
          success: true,
          alreadyCredited: Boolean(mem.coinsCredited),
          duplicateWebhookEvent: true,
          payment: { ...mem, id: mem.id || mem._id },
          walletBalance: u?.walletBalance,
        };
      }

      if (mem.coinsCredited) {
        if (mem.razorpayPaymentId && mem.razorpayPaymentId !== razorpayPaymentId) {
          return {
            success: false,
            alreadyCredited: true,
            error: "Order has already been settled under a different payment ID.",
          };
        }
        if (webhookEventId) mem.processedWebhookEvents.push(webhookEventId);
        const u = await db.users.findById(String(mem.userId));
        return {
          success: true,
          alreadyCredited: true,
          payment: { ...mem, id: mem.id || mem._id },
          walletBalance: u?.walletBalance,
        };
      }

      const duplicatePid = memoryPayments.find(
        (item) => item.razorpayPaymentId === razorpayPaymentId && item.coinsCredited
      );
      if (duplicatePid && duplicatePid.razorpayOrderId !== razorpayOrderId) {
        return {
          success: false,
          alreadyCredited: true,
          error: "This Razorpay payment ID has already been processed.",
        };
      }

      const previousMemStatus = mem.status || "created";
      const previousMemPaymentId = mem.razorpayPaymentId;

      // Atomic synchronous state transition in JS event loop
      mem.status = "captured";
      mem.razorpayPaymentId = razorpayPaymentId;
      if (paymentMethod) mem.paymentMethod = paymentMethod;
      if (signatureVerified) mem.razorpaySignatureVerified = true;
      delete mem.failureCode;
      delete mem.failureReason;
      mem.coinsCredited = true;
      mem.creditedAt = new Date();
      mem.updatedAt = new Date();
      if (webhookEventId) mem.processedWebhookEvents.push(webhookEventId);

      const updatedUser = await db.users.updateBalance(String(mem.userId), mem.totalCoins);
      if (!updatedUser) {
        mem.coinsCredited = false;
        mem.status = previousMemStatus;
        mem.razorpayPaymentId = previousMemPaymentId;
        delete mem.creditedAt;
        if (webhookEventId) {
          mem.processedWebhookEvents = mem.processedWebhookEvents.filter(
            (id: string) => id !== webhookEventId
          );
        }
        return { success: false, alreadyCredited: false, error: "User account not found." };
      }

      try {
        await db.walletLedger.record({
          userId: String(mem.userId),
          type: "PACKAGE_PURCHASE",
          amount: mem.totalCoins,
          balanceAfter: updatedUser.walletBalance,
          description: `Purchased ${mem.packageTitle} (+${mem.totalCoins} coins via Razorpay Test Mode)`,
          referenceId: razorpayPaymentId,
          metadata: {
            gateway: "razorpay",
            mode: "test",
            razorpayOrderId,
            razorpayPaymentId,
            packageId: mem.packageId,
            amountPaise: mem.amount,
            amountInr: mem.amountInr,
            currency: mem.currency,
            coins: mem.coins,
            bonusCoins: mem.bonusCoins,
            totalCoins: mem.totalCoins,
            paymentMethod: mem.paymentMethod,
            status: "captured",
            timestamp: new Date().toISOString(),
          },
        });
      } catch (ledgerErr) {
        await db.users.updateBalance(String(mem.userId), -mem.totalCoins);
        mem.coinsCredited = false;
        mem.status = previousMemStatus;
        mem.razorpayPaymentId = previousMemPaymentId;
        delete mem.creditedAt;
        if (webhookEventId) {
          mem.processedWebhookEvents = mem.processedWebhookEvents.filter(
            (id: string) => id !== webhookEventId
          );
        }
        throw ledgerErr;
      }

      return {
        success: true,
        alreadyCredited: false,
        payment: { ...mem, id: mem.id || mem._id },
        walletBalance: updatedUser.walletBalance,
      };
    },
  },
};
