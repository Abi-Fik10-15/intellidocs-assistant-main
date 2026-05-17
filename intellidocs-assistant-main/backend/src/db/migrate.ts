import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./pool.js";
import { logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = await fs.readFile(schemaPath, "utf-8");

  logger.info("Running database migrations...");
  await pool.query(sql);
  logger.info("Migrations completed successfully");
  await pool.end();
}

migrate().catch((err) => {
  logger.error("Migration failed", { error: err });
  process.exit(1);
});
