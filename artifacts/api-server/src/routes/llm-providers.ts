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
import { listLlmProviders, type LlmAdapter } from "../lib/llm-provider";
import { encryptLlmApiKey } from "../lib/llm-secret";
import { slugify } from "../lib/slugify";

const router: IRouter = Router();
const adapters = new Set<LlmAdapter>(["openai-compatible", "openai", "anthropic", "gemini"]);

function validBaseUrl(value: string, adapter: LlmAdapter) {
  const fallback = adapter === "openai" ? "https://api.openai.com/v1"
    : adapter === "anthropic" ? "https://api.anthropic.com"
      : adapter === "gemini" ? "https://generativelanguage.googleapis.com/v1beta"
        : "";
  const candidate = value || fallback;
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return "";
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local") ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd|fe80)/i.test(url.hostname)) return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

router.get("/admin/llm-providers", requireAdmin, (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(listLlmProviders());
});

router.post("/admin/llm-providers", requireAdmin, (req, res) => {
  const parsed = CreateLlmProviderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a provider name, model, and API key." });
    return;
  }

  const name = parsed.data.name.trim();
  const adapter = parsed.data.adapter as LlmAdapter;
  const model = parsed.data.model.trim();
  const apiKey = parsed.data.apiKey.trim();
  const rawBaseUrl = parsed.data.baseUrl?.trim() || "";
  const baseUrl = adapters.has(adapter) ? validBaseUrl(rawBaseUrl, adapter) : "";
  if (!apiKey || name.length < 1 || !adapters.has(adapter) || model.length < 1 || !baseUrl) {
    res.status(400).json({ error: "Enter a valid provider name, supported adapter, model, HTTPS endpoint, and API key." });
    return;
  }

  const baseId = slugify(name) || adapter;
  let id = baseId;
  let suffix = 2;
  while (get<{ id: string }>("SELECT id FROM llm_providers WHERE id = ?", id)) id = `${baseId}-${suffix++}`;
  let encryptedApiKey: string;
  try {
    encryptedApiKey = encryptLlmApiKey(apiKey, id);
  } catch {
    res.status(503).json({ error: "Provider key encryption is unavailable. Check the server secret configuration." });
    return;
  }

  const createdAt = new Date().toISOString();
  run(
    "INSERT INTO llm_providers (id, name, adapter, base_url, model, api_key_secret_name, api_key_encrypted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id, name, adapter, baseUrl, model, "", encryptedApiKey, createdAt,
  );
  const admin = currentAdmin(req)!;
  recordActivity("admin", admin.id, admin.email, "llm_provider_created", "llm_provider", null, name);
  res.setHeader("Cache-Control", "no-store");
  res.status(201).json(CreateLlmProviderResponse.parse(listLlmProviders().find((item) => item.id === id)));
});

router.patch("/admin/llm-providers/:id", requireAdmin, (req, res) => {
  const params = UpdateLlmProviderKeyParams.safeParse(req.params);
  const parsed = UpdateLlmProviderKeyBody.safeParse(req.body);
  if (!params.success || !parsed.success || !parsed.data.apiKey.trim()) {
    res.status(400).json({ error: "Enter a valid API key." });
    return;
  }

  const provider = get<{ id: string; name: string }>(
    "SELECT id, name FROM llm_providers WHERE id = ?",
    params.data.id,
  );
  if (!provider) {
    res.status(404).json({ error: "LLM provider configuration not found." });
    return;
  }

  let encryptedApiKey: string;
  try {
    encryptedApiKey = encryptLlmApiKey(parsed.data.apiKey.trim(), params.data.id);
  } catch {
    res.status(503).json({ error: "Provider key encryption is unavailable. Check the server secret configuration." });
    return;
  }

  run(
    "UPDATE llm_providers SET api_key_secret_name = '', api_key_encrypted = ? WHERE id = ?",
    encryptedApiKey,
    provider.id,
  );
  const admin = currentAdmin(req)!;
  recordActivity("admin", admin.id, admin.email, "llm_provider_key_updated", "llm_provider", null, provider.name);
  const updated = listLlmProviders().find((item) => item.id === provider.id);
  if (!updated) {
    res.status(500).json({ error: "The provider was updated, but its status could not be loaded." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(UpdateLlmProviderKeyResponse.parse(updated));
});

router.delete("/admin/llm-providers/:id", requireAdmin, (req, res) => {
  const provider = get<{ id: string; name: string }>("SELECT id, name FROM llm_providers WHERE id = ?", req.params.id);
  if (!provider) {
    res.status(404).json({ error: "LLM provider configuration not found." });
    return;
  }
  run("DELETE FROM llm_providers WHERE id = ?", provider.id);
  const admin = currentAdmin(req)!;
  recordActivity("admin", admin.id, admin.email, "llm_provider_deleted", "llm_provider", null, provider.name);
  res.setHeader("Cache-Control", "no-store");
  res.sendStatus(204);
});

export default router;
