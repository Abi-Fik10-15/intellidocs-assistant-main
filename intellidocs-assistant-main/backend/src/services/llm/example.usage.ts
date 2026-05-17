/**
 * Sample usage — not imported at runtime.
 *
 * Switch providers without code changes:
 *   LLM_PROVIDER=openai   (default)
 *   LLM_PROVIDER=claude
 *   LLM_PROVIDER=gemini
 */
import { createLLMGateway } from "./gateway.js";
import type { ChatMessage, ToolDefinition } from "./providers/types.js";

async function sampleChatWithTools() {
  const llm = createLLMGateway();

  const messages: ChatMessage[] = [
    { role: "system", content: "You are a document assistant." },
    { role: "user", content: "Search for revenue figures in Q3 reports." },
  ];

  const tools: ToolDefinition[] = [
    {
      name: "search_documents",
      description: "Semantic search over uploaded documents",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  ];

  const response = await llm.generateResponse({ messages, tools });

  if (response.toolCalls?.length) {
    const toolResults = response.toolCalls.map((call) => ({
      toolCallId: call.id,
      name: call.name,
      content: JSON.stringify({ results: [] }),
    }));

    const followUp = await llm.callTools(
      [...messages, { role: "assistant", content: response.content }],
      toolResults,
    );

    console.log(followUp.content);
    return;
  }

  console.log(response.content);
}

async function sampleEmbedding() {
  const llm = createLLMGateway();
  const vector = await llm.createEmbedding("chunk of document text");
  console.log("embedding dimensions:", vector.length);
}

async function sampleStructuredJson() {
  const llm = createLLMGateway();
  const result = await llm.generateResponse({
    messages: [{ role: "user", content: "List 3 key entities as JSON." }],
    responseFormat: "json",
  });
  console.log(result.structured ?? result.content);
}

// Uncomment to run manually: npx tsx src/services/llm/example.usage.ts
// void sampleChatWithTools();
// void sampleEmbedding();
// void sampleStructuredJson();

export { sampleChatWithTools, sampleEmbedding, sampleStructuredJson };
