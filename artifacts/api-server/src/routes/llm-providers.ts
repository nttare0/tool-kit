import { Router, type IRouter } from "express";
import {
  CreateLlmProviderBody,
  CreateLlmProviderResponse,
  UpdateLlmProviderKeyBody,
  UpdateLlmProviderKeyParams,
  UpdateLlmProviderKeyResponse,
} from "@workspace/api-zod";
import { requireAdmin, currentAdmin } from "../lib/auth";
import { recordActivity } from "../lib/activity";
import { get, run } from "../lib/sqlite";
import {
  completeWithProvider,
  discoverProviderModels,
  listLlmProviders,
  type LlmAdapter,
} from "../lib/llm-provider";
import { encryptLlmApiKey } from "../lib/llm-secret";
import { slugify } from "../lib/slugify";

const router: IRouter = Router();
const adapters = new Set<LlmAdapter>([
  "openai-compatible",
  "openai",
  "openai-responses",
  "anthropic",
  "gemini",
]);

function validBaseUrl(value: string, adapter: LlmAdapter) {
  const fallback =
    adapter === "openai" || adapter === "openai-responses"
      ? "https://api.openai.com/v1"
      : adapter === "anthropic"
        ? "https://api.anthropic.com"
        : adapter === "gemini"
          ? "https://generativelanguage.googleapis.com/v1beta"
          : "";
  const candidate = value || fallback;
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return "";
    if (
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local") ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd|fe80)/i.test(
        url.hostname,
      )
    )
      return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

router.get("/admin/llm-providers", requireAdmin, async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await listLlmProviders());
});

router.post("/admin/llm-providers", requireAdmin, async (req, res) => {
  const parsed = CreateLlmProviderBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Enter a provider name, model, and API key." });
    return;
  }

  const name = parsed.data.name.trim();
  const adapter = parsed.data.adapter as LlmAdapter;
  const model = parsed.data.model.trim();
  const apiKey = parsed.data.apiKey.trim();
  const rawBaseUrl = parsed.data.baseUrl?.trim() || "";
  const baseUrl = adapters.has(adapter)
    ? validBaseUrl(rawBaseUrl, adapter)
    : "";
  if (
    !apiKey ||
    name.length < 1 ||
    !adapters.has(adapter) ||
    model.length < 1 ||
    !baseUrl
  ) {
    res.status(400).json({
      error:
        "Enter a valid provider name, supported adapter, model, HTTPS endpoint, and API key.",
    });
    return;
  }

  const baseId = slugify(name) || adapter;
  let id = baseId;
  let suffix = 2;
  while (
    await get<{ id: string }>("SELECT id FROM llm_providers WHERE id = ?", id)
  )
    id = `${baseId}-${suffix++}`;
  let encryptedApiKey: string;
  try {
    encryptedApiKey = encryptLlmApiKey(apiKey, id);
  } catch {
    res.status(503).json({
      error:
        "Provider key encryption is unavailable. Check the server secret configuration.",
    });
    return;
  }

  const createdAt = new Date().toISOString();
  await run(
    "INSERT INTO llm_providers (id, name, adapter, base_url, model, api_key_secret_name, api_key_encrypted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    name,
    adapter,
    baseUrl,
    model,
    "",
    encryptedApiKey,
    createdAt,
  );
  const admin = (await currentAdmin(req))!;
  await recordActivity(
    "admin",
    admin.id,
    admin.email,
    "llm_provider_created",
    "llm_provider",
    null,
    name,
  );
  res.setHeader("Cache-Control", "no-store");
  res
    .status(201)
    .json(
      CreateLlmProviderResponse.parse(
        (await listLlmProviders()).find((item) => item.id === id),
      ),
    );
});

router.patch("/admin/llm-providers/:id", requireAdmin, async (req, res) => {
  const params = UpdateLlmProviderKeyParams.safeParse(req.params);
  const parsed = UpdateLlmProviderKeyBody.safeParse(req.body);
  if (!params.success || !parsed.success || !Object.keys(parsed.data).length) {
    res
      .status(400)
      .json({ error: "Enter provider settings or a replacement key." });
    return;
  }
  const provider = await get<{
    id: string;
    name: string;
    adapter: LlmAdapter;
    base_url: string;
    model: string;
  }>(
    "SELECT id, name, adapter, base_url, model FROM llm_providers WHERE id = ?",
    params.data.id,
  );
  if (!provider) {
    res.status(404).json({ error: "LLM provider configuration not found." });
    return;
  }
  const adapter = parsed.data.adapter || provider.adapter;
  const baseUrl = validBaseUrl(
    parsed.data.baseUrl?.trim() || provider.base_url,
    adapter,
  );
  const name = parsed.data.name?.trim() ?? provider.name;
  const model = parsed.data.model?.trim() ?? provider.model;
  if (
    !adapters.has(adapter) ||
    !baseUrl ||
    !name ||
    !model ||
    (parsed.data.apiKey !== undefined && !parsed.data.apiKey.trim())
  ) {
    res
      .status(400)
      .json({
        error:
          "Enter a valid provider, model, HTTPS endpoint, and nonempty key if replacing it.",
      });
    return;
  }
  if (parsed.data.apiKey) {
    const encrypted = encryptLlmApiKey(parsed.data.apiKey.trim(), provider.id);
    await run(
      "UPDATE llm_providers SET name = ?, adapter = ?, base_url = ?, model = ?, api_key_secret_name = '', api_key_encrypted = ? WHERE id = ?",
      name,
      adapter,
      baseUrl,
      model,
      encrypted,
      provider.id,
    );
  } else {
    // Never send a saved credential to a different endpoint without explicitly
    // confirming a new key for that destination.
    if (baseUrl !== provider.base_url || adapter !== provider.adapter) {
      res
        .status(400)
        .json({
          error: "Re-enter the API key when changing endpoint or protocol.",
        });
      return;
    }
    await run(
      "UPDATE llm_providers SET name = ?, model = ? WHERE id = ?",
      name,
      model,
      provider.id,
    );
  }
  const admin = (await currentAdmin(req))!;
  await recordActivity(
    "admin",
    admin.id,
    admin.email,
    "llm_provider_key_updated",
    "llm_provider",
    null,
    provider.name,
  );
  const updated = (await listLlmProviders()).find(
    (item) => item.id === provider.id,
  );
  if (!updated) {
    res.status(500).json({
      error: "The provider was updated, but its status could not be loaded.",
    });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(UpdateLlmProviderKeyResponse.parse(updated));
});

router.get(
  "/admin/llm-providers/:id/models",
  requireAdmin,
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      res.json({
        models: await discoverProviderModels(req.params.id as string),
      });
    } catch (error) {
      res
        .status(502)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Model discovery failed. Enter a model manually.",
        });
    }
  },
);

router.post("/admin/llm-providers/:id/test", requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const content = await completeWithProvider(req.params.id as string, [
      { role: "system", content: 'Return JSON only: {"reply":"Connected"}.' },
      { role: "user", content: "Test this provider connection." },
    ]);
    if (!content)
      throw new Error(
        "The provider returned an empty response. Check model settings.",
      );
    res.json({ ok: true, message: "Provider responded successfully." });
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error ? error.message : "Provider connection failed.",
    });
  }
});

router.delete("/admin/llm-providers/:id", requireAdmin, async (req, res) => {
  const provider = await get<{ id: string; name: string }>(
    "SELECT id, name FROM llm_providers WHERE id = ?",
    req.params.id,
  );
  if (!provider) {
    res.status(404).json({ error: "LLM provider configuration not found." });
    return;
  }
  await run("DELETE FROM llm_providers WHERE id = ?", provider.id);
  const admin = (await currentAdmin(req))!;
  await recordActivity(
    "admin",
    admin.id,
    admin.email,
    "llm_provider_deleted",
    "llm_provider",
    null,
    provider.name,
  );
  res.setHeader("Cache-Control", "no-store");
  res.sendStatus(204);
});

export default router;
