import { Router, type IRouter } from "express";
import { requireAdmin, currentAdmin } from "../lib/auth";
import { recordActivity } from "../lib/activity";
import { get, run } from "../lib/sqlite";
import { listLlmProviders, type LlmAdapter } from "../lib/llm-provider";
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
  res.json(listLlmProviders());
});

router.post("/admin/llm-providers", requireAdmin, (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";
  const adapter = req.body?.adapter as LlmAdapter;
  const model = typeof req.body?.model === "string" ? req.body.model.trim().slice(0, 120) : "";
  const secretName = typeof req.body?.apiKeySecretName === "string" ? req.body.apiKeySecretName.trim().toUpperCase() : "";
  const rawBaseUrl = typeof req.body?.baseUrl === "string" ? req.body.baseUrl.trim() : "";
  const baseUrl = adapters.has(adapter) ? validBaseUrl(rawBaseUrl, adapter) : "";
  if (name.length < 1 || !adapters.has(adapter) || model.length < 1 || !baseUrl ||
    !/^(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|TOOLSTACK_LLM_[A-Z0-9_]+_API_KEY)$/.test(secretName)) {
    res.status(400).json({ error: "Enter a valid provider name, supported adapter, model, HTTPS endpoint, and approved secret variable name." });
    return;
  }
  const baseId = slugify(name) || adapter;
  let id = baseId;
  let suffix = 2;
  while (get<{ id: string }>("SELECT id FROM llm_providers WHERE id = ?", id)) id = `${baseId}-${suffix++}`;
  const createdAt = new Date().toISOString();
  run(
    "INSERT INTO llm_providers (id, name, adapter, base_url, model, api_key_secret_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id, name, adapter, baseUrl, model, secretName, createdAt,
  );
  const admin = currentAdmin(req)!;
  recordActivity("admin", admin.id, admin.email, "llm_provider_created", "llm_provider", null, name);
  res.status(201).json(listLlmProviders().find((item) => item.id === id));
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
  res.sendStatus(204);
});

export default router;
