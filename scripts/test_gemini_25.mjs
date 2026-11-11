import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
let apiKey = "";
for (const line of envFile.split("\n")) {
  if (line.startsWith("GEMINI_API_KEY=")) {
    apiKey = line.split("=")[1].trim().replace(/^["']|["']$/g, "");
  }
}

async function run() {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Test gemini-2.5-flash
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const res = await model.generateContent("Return valid JSON: {\"status\": \"ok\", \"model\": \"gemini-2.5-flash\"}");
    console.log("Success with gemini-2.5-flash:", res.response.text());
  } catch (e) {
    console.log("Error with gemini-2.5-flash:", e.message);
  }
}

run();
