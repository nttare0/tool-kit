export type AiProtocol =
  "openai-compatible" | "openai" | "openai-responses" | "anthropic" | "gemini";
// Public endpoint presets only. Keys are supplied privately by the administrator.
export const aiPresets: Array<{
  id: string;
  name: string;
  adapter: AiProtocol;
  baseUrl: string;
}> = [
  {
    id: "custom",
    name: "Custom / OpenAI-compatible",
    adapter: "openai-compatible",
    baseUrl: "",
  },
  {
    id: "openai",
    name: "OpenAI Chat Completions",
    adapter: "openai",
    baseUrl: "https://api.openai.com/v1",
  },
  {
    id: "responses",
    name: "OpenAI Responses",
    adapter: "openai-responses",
    baseUrl: "https://api.openai.com/v1",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    adapter: "anthropic",
    baseUrl: "https://api.anthropic.com",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    adapter: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    adapter: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  {
    id: "groq",
    name: "Groq",
    adapter: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    adapter: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
  },
  {
    id: "xai",
    name: "xAI",
    adapter: "openai-compatible",
    baseUrl: "https://api.x.ai/v1",
  },
  {
    id: "mistral",
    name: "Mistral",
    adapter: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
  },
  {
    id: "together",
    name: "Together AI",
    adapter: "openai-compatible",
    baseUrl: "https://api.together.xyz/v1",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    adapter: "openai-compatible",
    baseUrl: "https://api.fireworks.ai/inference/v1",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    adapter: "openai-compatible",
    baseUrl: "https://api.perplexity.ai",
  },
];
