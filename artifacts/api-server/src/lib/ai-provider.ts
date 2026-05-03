import { db } from "@workspace/db";
import { systemConfigTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import OpenAI from "openai";

export const AI_PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "State of the art in reasoning and instruction following",
    defaultModel: "claude-sonnet-4-6",
    defaultBaseUrl: null,
    requiresBaseUrl: false,
    models: ["claude-opus-4-5", "claude-sonnet-4-6", "claude-haiku-4-5"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Aggregates 200+ models — ideal for comparing cost and quality",
    defaultModel: "anthropic/claude-sonnet-4-5",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresBaseUrl: false,
    models: ["anthropic/claude-sonnet-4-5", "openai/gpt-4o", "google/gemini-2.0-flash-001", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat"],
  },
  {
    id: "azure_openai",
    name: "Azure OpenAI",
    description: "GPT-4o com compliance enterprise (SOC2, HIPAA, GDPR)",
    defaultModel: "gpt-4o",
    defaultBaseUrl: "",
    requiresBaseUrl: true,
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  },
  {
    id: "groq",
    name: "Groq",
    description: "Blazing fast inference (LPU) — ideal for real-time interviews",
    defaultModel: "llama-3.3-70b-versatile",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    requiresBaseUrl: false,
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Very low cost, competitive quality with GPT-4",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    requiresBaseUrl: false,
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "nvidia_nim",
    name: "NVIDIA NIM",
    description: "Open-source models running on NVIDIA infrastructure",
    defaultModel: "nvidia/llama-3.1-nemotron-70b-instruct",
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
    requiresBaseUrl: false,
    models: ["nvidia/llama-3.1-nemotron-70b-instruct", "meta/llama-3.1-405b-instruct", "mistralai/mixtral-8x22b-instruct-v0.1"],
  },
  {
    id: "google_vertex",
    name: "Google Vertex (Gemini)",
    description: "Gemini with enterprise compliance and 2M token context",
    defaultModel: "gemini-2.0-flash",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    requiresBaseUrl: false,
    models: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"],
  },
] as const;

export type ProviderId = typeof AI_PROVIDERS[number]["id"];

const AI_CONFIG_KEYS = ["ai_provider", "ai_api_key", "ai_model", "ai_base_url", "ai_api_version"];

export interface AIConfig {
  provider: ProviderId;
  apiKey: string | null;
  model: string;
  baseUrl: string | null;
  apiVersion: string | null;
}

export async function getAIConfig(): Promise<AIConfig> {
  const rows = await db
    .select()
    .from(systemConfigTable)
    .where(inArray(systemConfigTable.key, AI_CONFIG_KEYS));

  const cfg: Record<string, string | null> = {};
  for (const r of rows) cfg[r.key] = r.value;

  const provider = (cfg.ai_provider ?? "anthropic") as ProviderId;
  const providerDef = AI_PROVIDERS.find(p => p.id === provider) ?? AI_PROVIDERS[0];

  return {
    provider,
    apiKey: cfg.ai_api_key ?? null,
    model: cfg.ai_model ?? providerDef.defaultModel,
    baseUrl: cfg.ai_base_url ?? providerDef.defaultBaseUrl ?? null,
    apiVersion: cfg.ai_api_version ?? null,
  };
}

function getOpenAIClient(cfg: AIConfig): OpenAI {
  const clientOpts: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: cfg.apiKey ?? "placeholder",
    baseURL: cfg.baseUrl ?? undefined,
  };

  if (cfg.provider === "azure_openai") {
    return new OpenAI({
      apiKey: cfg.apiKey ?? "placeholder",
      baseURL: cfg.baseUrl ?? undefined,
      defaultQuery: { "api-version": cfg.apiVersion ?? "2024-08-01-preview" },
      defaultHeaders: { "api-key": cfg.apiKey ?? "" },
    });
  }

  if (cfg.provider === "openrouter") {
    clientOpts.defaultHeaders = {
      "HTTP-Referer": "https://hireforward.ai",
      "X-Title": "HireForward",
    };
  }

  return new OpenAI(clientOpts);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamChatParams {
  systemPrompt: string;
  messages: ChatMessage[];
  onChunk: (text: string) => void;
}

export interface StreamChatResult {
  tokensInput: number;
  tokensOutput: number;
  fullText: string;
}

export async function streamChat(cfg: AIConfig, params: StreamChatParams): Promise<StreamChatResult> {
  const { systemPrompt, messages, onChunk } = params;

  if (cfg.provider === "anthropic") {
    const useCustomKey = !!cfg.apiKey;
    const client = useCustomKey
      ? new (await import("@anthropic-ai/sdk")).default({ apiKey: cfg.apiKey! })
      : anthropic;

    let fullText = "";
    const stream = client.messages.stream({
      model: cfg.model,
      max_tokens: 8192,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
        onChunk(event.delta.text);
      }
    }

    const final = await stream.finalMessage();
    return {
      tokensInput: final.usage.input_tokens,
      tokensOutput: final.usage.output_tokens,
      fullText,
    };
  }

  const client = getOpenAIClient(cfg);
  let fullText = "";
  let tokensInput = 0;
  let tokensOutput = 0;

  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const stream = await client.chat.completions.create({
    model: cfg.model,
    messages: allMessages,
    stream: true,
    stream_options: { include_usage: true },
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) {
      fullText += text;
      onChunk(text);
    }
    if (chunk.usage) {
      tokensInput = chunk.usage.prompt_tokens ?? 0;
      tokensOutput = chunk.usage.completion_tokens ?? 0;
    }
  }

  return { tokensInput, tokensOutput, fullText };
}

export interface CompleteChatResult {
  text: string;
  tokensInput: number;
  tokensOutput: number;
}

export async function completeChat(cfg: AIConfig, params: { systemPrompt: string; userMessage: string }): Promise<CompleteChatResult> {
  const { systemPrompt, userMessage } = params;

  if (cfg.provider === "anthropic") {
    const useCustomKey = !!cfg.apiKey;
    const client = useCustomKey
      ? new (await import("@anthropic-ai/sdk")).default({ apiKey: cfg.apiKey! })
      : anthropic;

    const message = await client.messages.create({
      model: cfg.model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = message.content[0];
    return {
      text: block.type === "text" ? block.text : "",
      tokensInput: message.usage.input_tokens,
      tokensOutput: message.usage.output_tokens,
    };
  }

  const client = getOpenAIClient(cfg);
  const response = await client.chat.completions.create({
    model: cfg.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return {
    text: response.choices[0]?.message?.content ?? "",
    tokensInput: response.usage?.prompt_tokens ?? 0,
    tokensOutput: response.usage?.completion_tokens ?? 0,
  };
}
