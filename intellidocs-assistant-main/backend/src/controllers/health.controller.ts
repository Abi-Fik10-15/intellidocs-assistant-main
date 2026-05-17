import type { Request, Response } from "express";
import { healthCheck } from "../db/pool.js";
import { sendSuccess } from "../utils/api-response.js";

export async function health(_req: Request, res: Response): Promise<void> {
  const dbOk = await healthCheck();
  sendSuccess(res, {
    status: dbOk ? "healthy" : "degraded",
    database: dbOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
}
