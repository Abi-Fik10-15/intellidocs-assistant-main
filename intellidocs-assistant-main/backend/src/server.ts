import { env } from "./config/index.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";
import { ensureUploadDir } from "./utils/file.js";

async function bootstrap(): Promise<void> {
  await ensureUploadDir();

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`, {
      env: env.NODE_ENV,
      llmProvider: env.LLM_PROVIDER,
      embeddingProvider: env.EMBEDDING_PROVIDER,
    });
    if (env.EMBEDDING_PROVIDER === "mock") {
      logger.warn(
        "EMBEDDING_PROVIDER=mock — using local dev embeddings. Chat still needs your LLM API key.",
      );
    }
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server", { error: err });
  process.exit(1);
});
