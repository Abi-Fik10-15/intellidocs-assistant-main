import multer from "multer";
import path from "path";
import { env } from "../config/index.js";
import { ensureUploadDir } from "../utils/file.js";
const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      const dir = await ensureUploadDir();
      cb(null, dir);
    } catch (err) {
      cb(err as Error, "");
    }
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: maxBytes },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".txt", ".md", ".markdown"];
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk =
      file.mimetype === "application/pdf" ||
      file.mimetype === "text/plain" ||
      file.mimetype === "text/markdown";

    if (mimeOk || allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: PDF, TXT, Markdown"));
    }
  },
});
