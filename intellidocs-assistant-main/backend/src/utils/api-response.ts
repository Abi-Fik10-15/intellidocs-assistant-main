import type { Response } from "express";
import type { ApiError, ApiSuccess } from "../types/index.js";

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { success: true, data };
  res.status(status).json(body);
}

export function sendError(
  res: Response,
  message: string,
  status = 500,
  code?: string,
  details?: unknown,
): void {
  const body: ApiError = {
    success: false,
    error: { message, code, details },
  };
  res.status(status).json(body);
}
