/** Approximate tokens as words * 1.3 (conservative for English text). */
const CHARS_PER_TOKEN = 4;

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

/**
 * Split text into overlapping chunks by approximate token count.
 */
export function chunkText(
  text: string,
  chunkSizeTokens: number,
  overlapTokens: number,
): TextChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunkChars = chunkSizeTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  const step = Math.max(1, chunkChars - overlapChars);

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkChars, normalized.length);

    if (end < normalized.length) {
      const breakAt = findBreakPoint(normalized, start, end);
      if (breakAt > start) end = breakAt;
    }

    const content = normalized.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        chunkIndex: index,
        tokenCount: estimateTokenCount(content),
      });
      index += 1;
    }

    if (end >= normalized.length) break;
    start += step;
  }

  return chunks;
}

function findBreakPoint(text: string, start: number, end: number): number {
  const slice = text.slice(start, end);
  const paragraph = slice.lastIndexOf("\n\n");
  if (paragraph > slice.length * 0.5) return start + paragraph;

  const sentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! "),
  );
  if (sentence > slice.length * 0.5) return start + sentence + 1;

  const word = slice.lastIndexOf(" ");
  if (word > slice.length * 0.5) return start + word;

  return end;
}
