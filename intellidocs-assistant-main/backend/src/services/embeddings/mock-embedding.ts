import crypto from "crypto";
import { env } from "../../config/index.js";

/** Deterministic local embeddings for dev when OpenAI quota is unavailable. */
export function createMockEmbedding(text: string): number[] {
  const dim = env.EMBEDDING_DIMENSIONS;
  const vec = new Float64Array(dim);

  const base = crypto.createHash("sha256").update(text).digest();
  for (let i = 0; i < dim; i++) {
    vec[i] = (base[i % base.length] / 127.5) - 1;
  }

  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  for (let w = 0; w < words.length; w++) {
    const wh = crypto.createHash("md5").update(words[w]).digest();
    for (let j = 0; j < wh.length; j++) {
      const idx = (wh[j] + w * 31) % dim;
      vec[idx] += wh[j] / 255;
    }
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => v / norm);
}
