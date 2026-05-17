import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { sendError } from "../utils/api-response.js";
import { formatProviderError } from "../utils/format-api-error.js";
import { logger } from "../utils/logger.js";
import { isProduction } from "../config/index.js";
import { LLMError } from "../services/llm/errors.js";

function isQuotaMessage(message: string): boolean {
  return message.includes("429") || /quota|billing/i.test(message);
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error("Request error", {
    name: err.name,
    message: err.message,
    stack: isProduction ? undefined : err.stack,
  });

  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.code, err.details);
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", err.flatten());
    return;
  }

  if (err.message?.includes("Invalid file type")) {
    sendError(res, err.message, 400, "INVALID_FILE");
    return;
  }

  if (err instanceof LLMError) {
    const quota = isQuotaMessage(err.message);
    const message = isProduction && !quota
      ? "LLM request failed"
      : formatProviderError(err.message);
    sendError(res, message, quota ? 429 : 502, quota ? "QUOTA_EXCEEDED" : "LLM_ERROR");
    return;
  }

  const message = isProduction
    ? "Internal server error"
    : formatProviderError(err.message);
  sendError(res, message, 500, "INTERNAL_ERROR");
}
