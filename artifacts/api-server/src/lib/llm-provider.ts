import { all, get } from "./sqlite";
import { decryptLlmApiKey } from "./llm-secret";

export type LlmAdapter =
  "openai-compatible" | "openai" | "anthropic" | "gemini";
export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderRow = {
  id: string;
  name: string;
  adapter: LlmAdapter;
  base_url: string;
  model: string;
  api_key_secret_name: string;
  api_key_encrypted: string | null;
  created_at: string;
};

export type PublicProvider = {
  id: string;
  name: string;
  adapter: LlmAdapter;
  baseUrl: string;
  model: string;
  configured: boolean;
  createdAt: string;
};

function publicProvider(row: ProviderRow): PublicProvider {
  let configured = Boolean(
    row.api_key_secret_name && process.env[row.api_key_secret_name],
  );
  if (row.api_key_encrypted) {
    try {
      configured = Boolean(decryptLlmApiKey(row.api_key_encrypted, row.id));
    } catch {
      configured = false;
    }
  }
  return {
    id: row.id,
    name: row.name,
    adapter: row.adapter,
    baseUrl: row.base_url,
    model: row.model,
    configured,
    createdAt: row.created_at,
  };
}

export async function listLlmProviders() {
  return (
    await all<ProviderRow>(
      "SELECT * FROM llm_providers ORDER BY created_at, name",
    )
  ).map(publicProvider);
}

async function getProvider(id?: string) {
  const row = id
    ? await get<ProviderRow>("SELECT * FROM llm_providers WHERE id = ?", id)
    : (
        await all<ProviderRow>(
          "SELECT * FROM llm_providers ORDER BY created_at, name",
        )
      ).find((row) => publicProvider(row).configured);
  if (!row)
    throw new Error(
      "Configure an LLM provider with a working API key in Admin → Settings first.",
    );
  const key = row.api_key_encrypted
    ? decryptLlmApiKey(row.api_key_encrypted, row.id)
    : row.api_key_secret_name
      ? process.env[row.api_key_secret_name]
      : undefined;
  if (!key)
    throw new Error(
      "Add an API key in Admin → Settings before using this provider.",
    );
  return { row, key };
}

function withPath(baseUrl: string, suffix: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${suffix.replace(/^\/+/, "")}`;
}

async function requestJson(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(45_000),
    });
    const data = (await response.json().catch(() => null)) as any;
    if (!response.ok) {
      const message =
        response.status === 401 || response.status === 403
          ? "The provider rejected its API key or permissions. Reconnect it in Admin → Settings."
          : response.status === 429
            ? "The provider quota or rate limit was reached. Check API billing/quota, then try again."
            : response.status === 404
              ? "The provider model or endpoint was not found. Check the model name and base URL in Settings."
              : response.status === 400
                ? "The provider rejected the request. Check that the model supports this adapter and JSON/text output."
                : `The provider returned an error (HTTP ${response.status}).`;
      throw new Error(message);
    }
    return data;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("The provider") ||
        error.message.startsWith("Add "))
    )
      throw error;
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    )
      throw new Error(
        "The provider took too long to respond. Try again or choose a faster model.",
      );
    throw new Error(
      "Could not reach the LLM provider. Check its endpoint, model, and network access.",
    );
  }
}

export async function completeWithProvider(
  providerId: string | undefined,
  messages: LlmMessage[],
) {
  const { row, key } = await getProvider(providerId);
  if (row.adapter === "anthropic") {
    const system = messages
      .filter((item) => item.role === "system")
      .map((item) => item.content)
      .join("\n\n");
    const conversation = messages.filter((item) => item.role !== "system");
    const data = await requestJson(
      withPath(row.base_url.replace(/\/v1\/?$/, ""), "v1/messages"),
      {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: row.model,
          max_tokens: 4096,
          system,
          messages: conversation,
        }),
      },
    );
    return Array.isArray(data?.content)
      ? data.content
          .filter((item: any) => item.type === "text")
          .map((item: any) => item.text)
          .join("\n")
          .trim()
      : "";
  }
  if (row.adapter === "gemini") {
    const contents = messages
      .filter((item) => item.role !== "system")
      .map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      }));
    const systemInstruction = messages
      .filter((item) => item.role === "system")
      .map((item) => item.content)
      .join("\n\n");
    const endpoint = new URL(
      withPath(
        row.base_url,
        `models/${encodeURIComponent(row.model)}:generateContent`,
      ),
    );
    const data = await requestJson(endpoint.toString(), {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents,
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
        generationConfig: {
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });
    return (
      data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text || "")
        .join("")
        .trim() || ""
    );
  }
  const data = await requestJson(withPath(row.base_url, "chat/completions"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: row.model,
      messages,
      ...(row.adapter === "openai"
        ? {
            max_completion_tokens: 4096,
            response_format: { type: "json_object" },
          }
        : { max_tokens: 4096 }),
    }),
  });
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

export function parseJsonResponse<T>(content: string): T {
  const clean = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start)
    throw new Error("The LLM response was not valid JSON. Try again.");
  return JSON.parse(clean.slice(start, end + 1)) as T;
}
