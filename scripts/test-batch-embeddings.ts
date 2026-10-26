import { GoogleGenerativeAI } from "@google/generative-ai";
import { getEnvConfig } from "../lib/config";

async function testBatchEmbeddings() {
  const { GEMINI_API_KEY } = getEnvConfig();
  console.log("GEMINI_API_KEY exists:", !!GEMINI_API_KEY);

  if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
    console.log("No API key, testing fallback embedding.");
    return;
  }

  const genAi = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAi.getGenerativeModel({ model: "text-embedding-004" });

  const texts = [
    "Primeiro texto para teste de embedding em lote.",
    "Segundo texto sobre estratégias de precificação e margem.",
    "Terceiro texto sobre governança e cultura organizacional antifrágil.",
  ];

  try {
    console.log("Testing batchEmbedContents...");
    const result = await model.batchEmbedContents({
      requests: texts.map((t) => ({
        content: { role: "user", parts: [{ text: t }] },
      })),
    });

    console.log("batchEmbedContents success! Embeddings count:", result.embeddings.length);
    console.log("Vector dimensions:", result.embeddings[0].values.length);
  } catch (err: any) {
    console.error("batchEmbedContents error:", err.message || err);
  }
}

testBatchEmbeddings().catch(console.error);
