import { all, get, run } from "./sqlite";
import { decryptLlmApiKey, encryptLlmApiKey } from "./llm-secret";

export type LlmAdapter =
  "openai-compatible" | "openai" | "openai-responses" | "anthropic" | "gemini";
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

class ProviderHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
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
      throw new ProviderHttpError(response.status, message);
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
  if (row.model === "auto") {
    const models = await discoverProviderModels(providerId);
    if (!models[0])
      throw new Error(
        "The provider lists no text models. Enter an exact model ID in Settings.",
      );
    row.model = models[0];
    await run(
      "UPDATE llm_providers SET model = ? WHERE id = ? AND model = 'auto'",
      row.model,
      row.id,
    );
  }
  if (row.adapter === "openai-responses") {
    const data = await requestJson(withPath(row.base_url, "responses"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: row.model,
        input: messages,
        max_output_tokens: 4096,
      }),
    });
    return (
      typeof data?.output_text === "string"
        ? data.output_text
        : data?.output
            ?.flatMap((item: any) => item.content || [])
            .filter((item: any) => item.type === "output_text")
            .map((item: any) => item.text || "")
            .join("\n") || ""
    ).trim();
  }
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
    const baseUrl = row.base_url
      .replace(/\/models(?:\/.*)?$/, "")
      .replace(/\/+$/, "");
    const model =
      row.model === "auto"
        ? await discoverGeminiModel(baseUrl, key)
        : row.model.replace(/^models\//, "");
    const options = {
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
    };
    let data;
    try {
      data = await requestJson(
        withPath(
          baseUrl,
          `models/${encodeURIComponent(model)}:generateContent`,
        ),
        options,
      );
    } catch (error) {
      // Retired/inaccessible model: ask Google which text-generation models this
      // key can actually use, then retry once. Never retry auth/quota errors.
      if (!(error instanceof ProviderHttpError) || error.status !== 404)
        throw error;
      const replacement = await discoverGeminiModel(baseUrl, key, model);
      if (replacement === model) throw error;
      data = await requestJson(
        withPath(
          baseUrl,
          `models/${encodeURIComponent(replacement)}:generateContent`,
        ),
        options,
      );
      await run(
        "UPDATE llm_providers SET model = ? WHERE id = ? AND model = ?",
        replacement,
        row.id,
        row.model,
      );
    }
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

/** Discovery sends a key only to the explicitly configured provider, never probes vendors. */
export async function discoverProviderModels(
  providerId?: string,
): Promise<string[]> {
  const { row, key } = await getProvider(providerId);
  if (row.adapter === "gemini") {
    const models = await geminiModels(row.base_url, key);
    return models;
  }
  const anthropic = row.adapter === "anthropic";
  const base = anthropic ? row.base_url.replace(/\/v1\/?$/, "") : row.base_url;
  const data = await requestJson(
    withPath(base, anthropic ? "v1/models" : "models"),
    {
      headers: anthropic
        ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
        : { authorization: `Bearer ${key}` },
    },
  );
  if (!Array.isArray(data?.data))
    throw new Error(
      "The provider does not support model discovery. Enter its exact model ID manually in Settings.",
    );
  return [
    ...new Set<string>(
      data.data
        .map((item: any) => item.id)
        .filter(
          (id: unknown): id is string =>
            typeof id === "string" &&
            id.length > 0 &&
            id.length <= 120 &&
            !/(embed|whisper|dall-e|tts|moderation|image)/i.test(id),
        ),
    ),
  ].sort();
}

async function geminiModels(baseUrl: string, key: string): Promise<string[]> {
  const models: Array<{ name: string; supportedGenerationMethods?: string[] }> =
    [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const url = new URL(withPath(baseUrl, "models"));
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await requestJson(url.toString(), {
      headers: { "x-goog-api-key": key },
    });
    if (Array.isArray(data?.models)) models.push(...data.models);
    pageToken =
      typeof data?.nextPageToken === "string" ? data.nextPageToken : "";
    if (!pageToken) break;
  }
  const names = models
    .filter(
      (item) =>
        typeof item.name === "string" &&
        item.supportedGenerationMethods?.includes("generateContent"),
    )
    .map((item) => item.name.replace(/^models\//, ""))
    .filter(
      (name) =>
        /^gemini-[a-z0-9.-]+$/i.test(name) &&
        !/(image|tts|audio|robotics|computer-use)/i.test(name),
    );
  return [...new Set(names)].sort();
}

export async function discoverGeminiModel(
  baseUrl: string,
  key: string,
  preferred?: string,
): Promise<string> {
  const names = await geminiModels(baseUrl, key);
  if (preferred && names.includes(preferred)) return preferred;
  const stable = names.filter((name) => !/(preview|exp|latest)/i.test(name));
  const candidates = stable.length ? stable : names;
  candidates.sort(
    (a, b) =>
      Number(b.includes("flash")) - Number(a.includes("flash")) ||
      b.localeCompare(a, undefined, { numeric: true }),
  );
  if (!candidates[0])
    throw new Error(
      "The provider lists no supported Gemini text models for this key. Check Google AI Studio project access.",
    );
  return candidates[0];
}

// Explicit deployment setup, not a per-request/key-overwriting bootstrap.
export async function configureDefaultGemini() {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) return;
  if ((await all("SELECT id FROM llm_providers LIMIT 1")).length) return;
  const id = "google-ai-studio";
  const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  const existing = await get<ProviderRow>(
    "SELECT * FROM llm_providers WHERE id = ?",
    id,
  );
  const model = existing?.model || "auto";
  const encrypted = encryptLlmApiKey(key, id);
  await run(
    `INSERT INTO llm_providers (id, name, adapter, base_url, model, api_key_secret_name, api_key_encrypted, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET adapter = excluded.adapter, base_url = excluded.base_url,
    model = excluded.model, api_key_encrypted = excluded.api_key_encrypted, api_key_secret_name = excluded.api_key_secret_name`,
    id,
    "Google AI Studio",
    "gemini",
    baseUrl,
    model,
    "GOOGLE_AI_API_KEY",
    encrypted,
    new Date().toISOString(),
  );
  const selected = await discoverGeminiModel(baseUrl, key);
  await run("UPDATE llm_providers SET model = ? WHERE id = ?", selected, id);
  const content = await completeWithProvider(id, [
    {
      role: "system",
      content: 'Return only JSON: {"reply":"Connected","draft":null}.',
    },
    { role: "user", content: "Test the connection." },
  ]);
  if (!content)
    throw new Error("The provider returned an empty test response.");
  parseJsonResponse(content);
  return selected;
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
