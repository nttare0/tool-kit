import { Router, type IRouter } from "express";
import { requireAdmin } from "../lib/auth";
import { all } from "../lib/sqlite";

const router: IRouter = Router();
const limits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;

router.post("/ai/suggest-tool", requireAdmin, async (req, res) => {
  const key = req.ip || "unknown";
  const current = limits.get(key);
  if (current && current.resetAt > Date.now() && current.count >= MAX_REQUESTS) {
    res.setHeader("Retry-After", String(Math.ceil((current.resetAt - Date.now()) / 1000)));
    res.status(429).json({ error: "AI suggestions are temporarily rate limited. Try again shortly." });
    return;
  }
  if (!current || current.resetAt <= Date.now()) limits.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  else current.count += 1;

  const websiteUrl = typeof req.body?.websiteUrl === "string" ? req.body.websiteUrl.trim().slice(0, 2000) : "";
  const toolName = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 120) : "";
  if (!websiteUrl || !/^https?:\/\//i.test(websiteUrl)) {
    res.status(400).json({ error: "Enter a valid tool website URL first." });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "AI suggestions are not configured. An administrator can add an OpenAI API key in Replit Secrets." });
    return;
  }
  const categories = all<{ name: string; description: string }>("SELECT name, description FROM categories ORDER BY name");
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You help an editor draft accurate software directory listings. Use only the product name, supplied URL, and category context. Do not claim to have visited the site or invent exact pricing, features, integrations, or facts. Mark uncertain pricing as 'Check pricing'. Return JSON with name, shortDescription, description, howItWorks, bestFor, pricing, and categorySuggestions (an array of up to 3 objects with name and description). Prefer existing categories when relevant; suggest a new category only if none fit. Keep the writing neutral and concise.",
          },
          {
            role: "user",
            content: JSON.stringify({ name: toolName, websiteUrl, availableCategories: categories }),
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      res.status(response.status === 429 ? 503 : 502).json({ error: payload.error?.message || "The AI suggestion service could not complete the request." });
      return;
    }
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: "The AI suggestion service returned an empty response." });
      return;
    }
    const suggestion = JSON.parse(content);
    const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
    const categorySuggestions = Array.isArray(suggestion.categorySuggestions)
      ? suggestion.categorySuggestions.slice(0, 3).map((item: unknown) => ({
          name: text((item as { name?: unknown })?.name, 60),
          description: text((item as { description?: unknown })?.description, 300),
        })).filter((item: { name: string }) => item.name)
      : [];
    res.json({
      name: text(suggestion.name, 120) || toolName,
      shortDescription: text(suggestion.shortDescription, 300),
      description: text(suggestion.description, 4000),
      howItWorks: text(suggestion.howItWorks, 3000),
      bestFor: text(suggestion.bestFor, 1000),
      pricing: text(suggestion.pricing, 100) || "Check pricing",
      categorySuggestions,
    });
  } catch (error) {
    req.log?.warn({ err: error }, "AI tool suggestion failed");
    res.status(502).json({ error: "Could not generate suggestions right now. Try again later." });
  }
});

export default router;