import { env } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

export class N8nService {
  private get webhookUrl(): string | undefined {
    return env.N8N_WEBHOOK_URL;
  }

  async trigger(event: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.webhookUrl) {
      logger.debug("n8n webhook not configured, skipping", { event });
      return;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (env.N8N_WEBHOOK_SECRET) {
        headers["X-Webhook-Secret"] = env.N8N_WEBHOOK_SECRET;
      }

      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ event, timestamp: new Date().toISOString(), ...payload }),
      });

      if (!response.ok) {
        logger.warn("n8n webhook returned non-OK status", {
          status: response.status,
          event,
        });
      } else {
        logger.info("n8n webhook triggered", { event });
      }
    } catch (err) {
      logger.warn("n8n webhook failed", {
        event,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async notifyDocumentIngested(data: {
    documentId: string;
    name: string;
    chunkCount: number;
  }): Promise<void> {
    await this.trigger("document.ingested", data);
  }

  async notifyChatCompleted(data: {
    conversationId: string;
    messageId: string;
    citationCount: number;
  }): Promise<void> {
    await this.trigger("chat.completed", data);
  }
}

export const n8nService = new N8nService();
