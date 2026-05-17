import {
  AGENT_SYSTEM_PROMPT,
  buildContextPrompt,
  buildDocumentCatalogPrompt,
} from "../../prompts/agent.system.js";
import { conversationRepository, documentRepository } from "../../repositories/index.js";
import { retrievalService } from "../retrieval/retrieval.service.js";
import { getLlmGateway } from "../llm/index.js";
import { n8nService } from "../integrations/n8n.service.js";
import { AGENT_TOOLS } from "./tools.js";
import { createToolExecutor } from "./tool-executor.js";
import type { ChatResponse, Citation, LLMMessage } from "../../types/index.js";
import { logger } from "../../utils/logger.js";

const MAX_TOOL_ITERATIONS = 5;

export class AgentService {
  /**
   * Run agentic chat with tool calling and citation tracking.
   * Architecture supports future streaming via AsyncGenerator extension.
   */
  async chat(
    userMessage: string,
    conversationId?: string,
    documentIds?: string[],
  ): Promise<ChatResponse> {
    let conversation = conversationId
      ? await conversationRepository.findById(conversationId)
      : null;

    if (!conversation) {
      conversation = await conversationRepository.create(
        userMessage.slice(0, 80) || "New conversation",
      );
    }

    await conversationRepository.addMessage({
      conversationId: conversation.id,
      role: "user",
      content: userMessage,
    });

    const history = await conversationRepository.getMessages(conversation.id);
    const priorMessages: LLMMessage[] = history
      .filter((m) => m.role !== "system")
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    const catalogRows =
      documentIds && documentIds.length > 0
        ? (
            await Promise.all(documentIds.map((id) => documentRepository.findById(id)))
          ).filter((d): d is NonNullable<typeof d> => d != null)
        : await documentRepository.findAll(100, 0);

    const catalogPrompt = buildDocumentCatalogPrompt(catalogRows);
    const executor = createToolExecutor(documentIds);

    const initialRetrieval = await retrievalService.search(userMessage, {
      documentIds,
    });

    const allCitations: Citation[] = [...initialRetrieval.citations];
    const citationKey = (c: Citation) =>
      `${c.documentId}:${c.chunkIndex}`;

    const dedupeCitations = (list: Citation[]): Citation[] => {
      const seen = new Set<string>();
      return list.filter((c) => {
        const key = citationKey(c);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `${AGENT_SYSTEM_PROMPT}\n\n${catalogPrompt}`,
      },
      ...priorMessages,
      {
        role: "user",
        content: `${userMessage}\n\n${buildContextPrompt(initialRetrieval.context)}`,
      },
    ];

    let iteration = 0;
    let finalAnswer = "";

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration += 1;
      const result = await getLlmGateway().generateResponse({
        messages,
        tools: AGENT_TOOLS,
        temperature: 0.2,
      });

      if (!result.toolCalls || result.toolCalls.length === 0) {
        finalAnswer = result.content;
        break;
      }

      messages.push({
        role: "assistant",
        content: result.content || "Calling tools to gather information.",
      });

      const toolResults: Array<{ toolCallId: string; name: string; content: string }> = [];

      for (const call of result.toolCalls) {
        const { output, citations } = await executor.execute(
          call.name,
          call.arguments,
        );
        allCitations.push(...citations);
        toolResults.push({
          toolCallId: call.id,
          name: call.name,
          content: output,
        });
      }

      for (const tr of toolResults) {
        messages.push({
          role: "user",
          content: `[Tool ${tr.name} result]:\n${tr.content}`,
        });
      }

      const followUp = await getLlmGateway().generateResponse({
        messages,
        tools: AGENT_TOOLS,
        temperature: 0.2,
      });

      if (!followUp.toolCalls?.length) {
        finalAnswer = followUp.content;
        break;
      }
    }

    if (!finalAnswer) {
      const fallback = await getLlmGateway().generateResponse({
        messages: [
          ...messages,
          {
            role: "user",
            content: "Provide your final answer based on all gathered context. Include citations.",
          },
        ],
        temperature: 0.2,
      });
      finalAnswer = fallback.content;
    }

    const citations = dedupeCitations(allCitations);

    const assistantMessage = await conversationRepository.addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: finalAnswer,
      citations,
    });

    await n8nService.notifyChatCompleted({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      citationCount: citations.length,
    });

    logger.info("Chat completed", {
      conversationId: conversation.id,
      citationCount: citations.length,
    });

    return {
      answer: finalAnswer,
      citations,
      conversationId: conversation.id,
      messageId: assistantMessage.id,
    };
  }
}

export const agentService = new AgentService();
