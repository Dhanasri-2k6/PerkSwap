import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

// Read .env
const envFile = fs.readFileSync(".env", "utf8");
let apiKey = "";
for (const line of envFile.split("\n")) {
  if (line.startsWith("GEMINI_API_KEY=")) {
    apiKey = line.split("=")[1].trim().replace(/^["']|["']$/g, "");
  }
}

console.log("Loaded API key:", apiKey ? apiKey.substring(0, 8) + "..." : "none");

async function run() {
  if (!apiKey) {
    console.log("No API key found in .env");
    return;
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const res = await model.generateContent("Return valid JSON: {\"status\": \"ok\"}");
    console.log("Gemini API Response:", res.response.text());
  } catch (e) {
    console.log("Gemini error message:", e.message);
  }
}

run();
