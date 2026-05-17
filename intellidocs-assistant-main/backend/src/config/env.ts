import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");

config({ path: envPath });

const envSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1),
    LLM_PROVIDER: z.enum(["openai", "claude", "gemini"]).default("openai"),
    LLM_REQUEST_TIMEOUT_MS: z.coerce.number().default(120_000),
    /** openai | gemini = API embeddings; mock = local dev (no quota) */
    EMBEDDING_PROVIDER: z.enum(["openai", "mock", "gemini"]).default("openai"),
    OPENAI_API_KEY: z
      .string()
      .optional()
      .transform((v) => v?.trim() || undefined),
    ANTHROPIC_API_KEY: z
      .string()
      .optional()
      .transform((v) => v?.trim() || undefined),
    GEMINI_API_KEY: z
      .string()
      .optional()
      .transform((v) => v?.trim() || undefined),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    CLAUDE_MODEL: z.string().default("claude-sonnet-4-20250514"),
    GEMINI_MODEL: z.string().default("gemini-2.0-flash-lite"),
    GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
    EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
    CHUNK_SIZE_TOKENS: z.coerce.number().default(500),
    CHUNK_OVERLAP_TOKENS: z.coerce.number().default(50),
    RETRIEVAL_TOP_K: z.coerce.number().default(5),
    UPLOAD_DIR: z.string().default("./uploads"),
    MAX_FILE_SIZE_MB: z.coerce.number().default(25),
    N8N_WEBHOOK_URL: z.string().optional(),
    N8N_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.LLM_PROVIDER === "openai" && !data.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `OPENAI_API_KEY is required when LLM_PROVIDER=openai. Set it in ${envPath}`,
        path: ["OPENAI_API_KEY"],
      });
    }
    if (data.LLM_PROVIDER === "claude" && !data.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude. Set it in ${envPath}`,
        path: ["ANTHROPIC_API_KEY"],
      });
    }
    if (data.LLM_PROVIDER === "gemini" && !data.GEMINI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `GEMINI_API_KEY is required when LLM_PROVIDER=gemini. Set it in ${envPath}`,
        path: ["GEMINI_API_KEY"],
      });
    }
    if (data.EMBEDDING_PROVIDER === "openai" && !data.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai (or use EMBEDDING_PROVIDER=gemini|mock). Set it in ${envPath}`,
        path: ["OPENAI_API_KEY"],
      });
    }
    if (data.EMBEDDING_PROVIDER === "gemini" && !data.GEMINI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini. Set it in ${envPath}`,
        path: ["GEMINI_API_KEY"],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
