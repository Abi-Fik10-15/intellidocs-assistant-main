import type { Request, Response } from "express";
import { sendSuccess } from "../utils/api-response.js";
import { getAppSettings, setLlmProvider } from "../services/settings.service.js";
import type { LLMProviderName } from "../services/llm/providers/types.js";

export async function getSettings(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, getAppSettings());
}

export async function updateLlmProvider(req: Request, res: Response): Promise<void> {
  const { provider } = req.body as { provider: LLMProviderName };
  sendSuccess(res, setLlmProvider(provider));
}
