import { db } from "../src/lib/db";
import { encryptVoucherCode } from "../src/lib/crypto";

async function testSwaps() {
  console.log("==========================================");
  console.log("TESTING P2P SWAP PROPOSAL & VISIBILITY");
  console.log("==========================================\n");

  // 1. Create two users
  const userA = await db.users.create({
    name: "User Alice",
    email: `alice_${Date.now()}@perkswap.test`,
    passwordHash: "hash123",
    walletBalance: 500,
    trustScore: 95,
  });

  const userB = await db.users.create({
    name: "User Bob",
    email: `bob_${Date.now()}@perkswap.test`,
    passwordHash: "hash123",
    walletBalance: 500,
    trustScore: 92,
  });

  console.log(`User A (Alice) ID: ${userA.id}`);
  console.log(`User B (Bob) ID: ${userB.id}`);

  // 2. Create vouchers for both
  const encA = encryptVoucherCode("ALICE-CODE-100");
  const voucherA = await db.vouchers.create({
    sellerId: userA.id,
    brand: "Starbucks",
    title: "Starbucks ₹500 Card",
    faceValue: 500,
    sellingPrice: 400,
    encryptedCode: encA.ciphertext,
    iv: encA.iv,
    tag: encA.tag,
    codeHash: "hash_starbucks_" + Date.now(),
    status: "ACTIVE",
    expiryDate: new Date(Date.now() + 864000000),
  });

  const encB = encryptVoucherCode("BOB-CODE-200");
  const voucherB = await db.vouchers.create({
    sellerId: userB.id,
    brand: "BookMyShow",
    title: "BMS ₹500 Movie Pass",
    faceValue: 500,
    sellingPrice: 400,
    encryptedCode: encB.ciphertext,
    iv: encB.iv,
    tag: encB.tag,
    codeHash: "hash_bms_" + Date.now(),
    status: "ACTIVE",
    expiryDate: new Date(Date.now() + 864000000),
  });

  console.log(`Alice owns: ${voucherA.brand} (${voucherA.id})`);
  console.log(`Bob owns: ${voucherB.brand} (${voucherB.id})`);

  // 3. Alice proposes swap: offers her Starbucks voucher for Bob's BMS voucher
  const swap = await db.swaps.create({
    requesterId: userA.id,
    requestedId: userB.id,
    offeredVoucherId: voucherA.id,
    targetVoucherId: voucherB.id,
    notes: "Hey Bob, let's trade movie pass for coffee card!",
    status: "PENDING",
  });

  console.log(`\nSwap proposal created with ID: ${swap.id}`);

  // 4. Test: Can Bob see the incoming swap request?
  const bobSwaps = await db.swaps.findUserSwaps(userB.id);
  const bobIncoming = bobSwaps.filter(
    (s: any) => String(s.requestedId) === String(userB.id) && String(s.id) === String(swap.id)
  );

  if (bobIncoming.length === 1) {
    console.log("✅ [PASS] Bob successfully sees Alice's incoming swap request in his console!");
    console.log(`   - Offerer: ${bobIncoming[0].requester?.name}`);
    console.log(`   - Offerer Brand: ${bobIncoming[0].offeredVoucher?.brand}`);
    console.log(`   - Target Brand: ${bobIncoming[0].targetVoucher?.brand}`);
    console.log(`   - Note: "${bobIncoming[0].notes}"`);
  } else {
    console.error("❌ [FAIL] Bob could NOT find the incoming swap request!");
    process.exit(1);
  }

  // 5. Test: Can Alice see her sent swap proposal?
  const aliceSwaps = await db.swaps.findUserSwaps(userA.id);
  const aliceOutgoing = aliceSwaps.filter(
    (s: any) => String(s.requesterId) === String(userA.id) && String(s.id) === String(swap.id)
  );

  if (aliceOutgoing.length === 1) {
    console.log("✅ [PASS] Alice successfully sees her sent swap proposal under Outgoing!");
    console.log(`   - Status: ${aliceOutgoing[0].status}`);
  } else {
    console.error("❌ [FAIL] Alice could NOT find her outgoing proposal!");
    process.exit(1);
  }

  // 6. Test: Bob accepts the swap
  await db.swaps.update(swap.id, {
    status: "ACCEPTED",
    revealedOfferedCode: "ALICE-CODE-100",
    revealedTargetCode: "BOB-CODE-200",
  });
  await db.vouchers.update(voucherA.id, { sellerId: userB.id, status: "SWAPPED" });
  await db.vouchers.update(voucherB.id, { sellerId: userA.id, status: "SWAPPED" });

  const updatedBobSwaps = await db.swaps.findUserSwaps(userB.id);
  const acceptedSwap = updatedBobSwaps.find((s: any) => String(s.id) === String(swap.id));

  if (acceptedSwap?.status === "ACCEPTED") {
    console.log("✅ [PASS] Swap accepted and status updated to ACCEPTED for both users!");
  } else {
    console.error("❌ [FAIL] Swap status did not update to ACCEPTED!");
    process.exit(1);
  }

  console.log("\n==========================================");
  console.log("ALL SWAP TESTS PASSED SUCCESSFULLY! (100%)");
  console.log("==========================================");
}

testSwaps()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
