import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/index.js";

let client: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY?.trim()) {
    throw new Error(
      "GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini. Add it to backend/.env",
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return client;
}

export async function createGeminiEmbedding(text: string): Promise<number[]> {
  const ai = getClient();
  const response = await ai.models.embedContent({
    model: env.GEMINI_EMBEDDING_MODEL,
    contents: text,
    config: {
      outputDimensionality: env.EMBEDDING_DIMENSIONS,
    },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error("Gemini returned empty embedding");
  }
  return values;
}

export async function createGeminiEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await createGeminiEmbedding(text));
  }
  return results;
}
