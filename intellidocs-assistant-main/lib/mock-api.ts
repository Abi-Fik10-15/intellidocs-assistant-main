import type { Citation } from "@/types/chat";
import { newId } from "@/store/chat-store";

const sampleAnswers = [
  "Based on the indexed documents, here are the key takeaways:\n\n- The **attention mechanism** scales context handling beyond recurrent limits.\n- Chunked retrieval keeps latency predictable for long PDFs.\n- Citations are anchored at the **chunk** level so users can verify claims.\n\n```ts\nasync function answer(q: string) {\n  const chunks = await retrieve(q, { k: 6 });\n  return synthesize(q, chunks);\n}\n```\n\nLet me know if you'd like me to dive deeper into any section.",
  "Here's a concise synthesis:\n\n1. The source defines the workflow in three stages — ingest, index, and respond.\n2. Each response is grounded in retrieved chunks, never the raw document.\n3. Confidence scoring is exposed alongside every citation.\n\n> **Tip:** Hover any citation chip to preview the supporting passage.",
  "Great question. The document suggests a layered approach:\n\n- A **retriever** narrows the search space.\n- A **reranker** prioritizes the strongest chunks.\n- The **generator** composes the final grounded answer.\n\nThis pattern keeps hallucinations low while preserving fluency.",
];

const sampleCitations = (): Citation[] => [
  { id: newId(), documentId: "d1", documentName: "AI_Research.pdf", chunk: Math.floor(Math.random() * 18) + 1 },
  { id: newId(), documentId: "d2", documentName: "Product_Spec.md", chunk: Math.floor(Math.random() * 9) + 1 },
];

export async function* mockStreamAnswer(prompt: string): AsyncGenerator<{ delta?: string; citations?: Citation[]; done?: boolean }> {
  const answer = sampleAnswers[Math.floor(Math.random() * sampleAnswers.length)];
  // Tokenize into small chunks for a natural typing effect
  const tokens = answer.match(/(\s+|[^\s]+)/g) ?? [answer];
  for (const t of tokens) {
    await new Promise((r) => setTimeout(r, 18 + Math.random() * 35));
    yield { delta: t };
  }
  yield { citations: sampleCitations(), done: true };
  void prompt;
}

export async function mockUpload(
  file: File,
  onProgress: (p: number) => void,
): Promise<void> {
  for (let p = 0; p <= 100; p += 8 + Math.random() * 10) {
    await new Promise((r) => setTimeout(r, 90));
    onProgress(Math.min(100, Math.round(p)));
  }
  onProgress(100);
  void file;
}
