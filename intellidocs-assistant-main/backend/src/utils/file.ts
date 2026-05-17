import fs from "fs/promises";
import path from "path";
import { env } from "../config/index.js";

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

export const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt", ".md", ".markdown"]);

export function getExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function isAllowedFile(mimetype: string, filename: string): boolean {
  const ext = getExtension(filename);
  return ALLOWED_MIME_TYPES.has(mimetype) || ALLOWED_EXTENSIONS.has(ext);
}

export async function ensureUploadDir(): Promise<string> {
  const dir = path.resolve(env.UPLOAD_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function readFileAsText(filePath: string, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = await fs.readFile(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }
  return fs.readFile(filePath, "utf-8");
}
