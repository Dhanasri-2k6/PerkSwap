import { createWorker } from "tesseract.js";

async function testTesseract() {
  console.log("Testing Tesseract worker initialization...");
  const worker = await createWorker("eng");
  console.log("Tesseract worker initialized successfully!");
  await worker.terminate();
  console.log("Tesseract worker terminated cleanly.");
}

testTesseract().catch((e) => console.error("Tesseract test failed:", e));
