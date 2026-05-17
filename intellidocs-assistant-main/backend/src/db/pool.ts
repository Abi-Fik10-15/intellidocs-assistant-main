import pg from "pg";
import pgvector from "pgvector/pg";
import { env } from "../config/index.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  logger.error("Unexpected database pool error", { error: err.message });
});

export async function getClient(): Promise<pg.PoolClient> {
  const client = await pool.connect();
  await pgvector.registerTypes(client);
  return client;
}

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
