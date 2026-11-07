import { Router, type IRouter } from "express";
import { requireAdmin } from "../lib/auth";
import { all } from "../lib/sqlite";
import {
  completeWithProvider,
  parseJsonResponse,
  type LlmMessage,
} from "../lib/llm-provider";

const router: IRouter = Router();
const limits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;
type Suggestion = {
  name?: unknown;
  shortDescription?: unknown;
  description?: unknown;
  howItWorks?: unknown;
  bestFor?: unknown;
  pricing?: unknown;
  categorySuggestions?: unknown;
};

function cleanSuggestion(value: Suggestion, fallbackName = "") {
  const text = (input: unknown, max: number) =>
    typeof input === "string" ? input.trim().slice(0, max) : "";
  const categorySuggestions = Array.isArray(value.categorySuggestions)
    ? value.categorySuggestions
        .slice(0, 3)
        .map((item: any) => ({
          name: text(item?.name, 60),
          description: text(item?.description, 300),
        }))
        .filter((item) => item.name)
    : [];
  return {
    name: text(value.name, 120) || fallbackName,
    shortDescription: text(value.shortDescription, 300),
    description: text(value.description, 4000),
    howItWorks: text(value.howItWorks, 3000),
    bestFor: text(value.bestFor, 1000),
    pricing: text(value.pricing, 100) || "Check pricing",
    categorySuggestions,
  };
}

function chatLimit(
  req: Parameters<typeof requireAdmin>[0],
  res: Parameters<typeof requireAdmin>[1],
) {
  const key = req.ip || "unknown";
  const current = limits.get(key);
  if (
    current &&
    current.resetAt > Date.now() &&
    current.count >= MAX_REQUESTS
  ) {
    res.setHeader(
      "Retry-After",
      String(Math.ceil((current.resetAt - Date.now()) / 1000)),
    );
    res
      .status(429)
      .json({
        error: "AI requests are temporarily rate limited. Try again shortly.",
      });
    return false;
  }
  if (!current || current.resetAt <= Date.now())
    limits.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  else current.count += 1;
  return true;
}

router.post("/ai/suggest-tool", requireAdmin, async (req, res) => {
  if (!chatLimit(req, res)) return;

  const websiteUrl =
    typeof req.body?.websiteUrl === "string"
      ? req.body.websiteUrl.trim().slice(0, 2000)
      : "";
  const toolName =
    typeof req.body?.name === "string"
      ? req.body.name.trim().slice(0, 120)
      : "";
  const providerId =
    typeof req.body?.providerId === "string" ? req.body.providerId : undefined;
  if (!websiteUrl || !/^https?:\/\//i.test(websiteUrl)) {
    res.status(400).json({ error: "Enter a valid tool website URL first." });
    return;
  }
  const categories = await all<{ name: string; description: string }>(
    "SELECT name, description FROM categories ORDER BY name",
  );
  try {
    const messages: LlmMessage[] = [
      {
        role: "system",
        content:
          "Draft accurate, concise software directory listings. Use only the supplied product name, URL and category context; do not claim to have visited the website or invent exact pricing or features. Mark uncertain pricing 'Check pricing'. Return JSON with name, shortDescription, description, howItWorks, bestFor, pricing and categorySuggestions (up to 3 {name,description} objects). Prefer existing categories when relevant.",
      },
      {
        role: "user",
        content: JSON.stringify({
          name: toolName,
          websiteUrl,
          availableCategories: categories,
        }),
      },
    ];
    const content = await completeWithProvider(providerId, messages);
    if (!content) {
      res
        .status(502)
        .json({
          error: "The AI suggestion service returned an empty response.",
        });
      return;
    }
    res.json(cleanSuggestion(parseJsonResponse<Suggestion>(content), toolName));
  } catch (error) {
    res
      .status(
        error instanceof Error && error.message.startsWith("Configure")
          ? 503
          : 502,
      )
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Could not generate suggestions right now. Try again later.",
      });
  }
});

router.post("/ai/chat", requireAdmin, async (req, res) => {
  if (!chatLimit(req, res)) return;
  const providerId =
    typeof req.body?.providerId === "string" ? req.body.providerId : undefined;
  const rawMessages: unknown[] = Array.isArray(req.body?.messages)
    ? req.body.messages.slice(-12)
    : [];
  const messages: LlmMessage[] = rawMessages
    .filter(
      (item): item is { role: "user" | "assistant"; content: string } =>
        Boolean(item) &&
        typeof item === "object" &&
        ((item as { role?: unknown }).role === "user" ||
          (item as { role?: unknown }).role === "assistant") &&
        typeof (item as { content?: unknown }).content === "string",
    )
    .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    res
      .status(400)
      .json({ error: "Send a user message to start the conversation." });
    return;
  }
  const categories = await all<{ name: string; description: string }>(
    "SELECT name, description FROM categories ORDER BY name",
  );
  const system = `You are Toolstack's private admin assistant. Help with the directory and answer briefly. If the admin asks to add or draft a software tool and supplies its official URL, return a listing draft for human review; never publish or imply that it has been published. Use only the supplied tool name, URL, and category context; do not claim to visit a website or invent exact product facts or pricing. Return only JSON with keys reply and draft. draft must be null unless the user asks to add a tool and a valid URL is included in the current conversation. Otherwise draft is an object with name, websiteUrl, shortDescription, description, howItWorks, bestFor, pricing, and categorySuggestions (up to 3 objects with name and description). Available categories: ${JSON.stringify(categories)}`;
  try {
    const content = await completeWithProvider(providerId, [
      { role: "system", content: system },
      ...messages,
    ]);
    const result = parseJsonResponse<{
      reply?: unknown;
      draft?: Suggestion | null;
    }>(content);
    const draft = result.draft ? cleanSuggestion(result.draft, "") : null;
    if (draft) {
      const latestUserText = messages
        .filter((item) => item.role === "user")
        .map((item) => item.content)
        .join("\n");
      const url = latestUserText
        .match(/https?:\/\/[^\s<>"')]+/i)?.[0]
        ?.replace(/[.,!?]+$/, "");
      if (!url) {
        res.json({
          reply:
            typeof result.reply === "string"
              ? result.reply.slice(0, 2000)
              : "Please include the tool's website URL so I can prepare a draft.",
          draft: null,
        });
        return;
      }
      draft.name =
        draft.name || latestUserText.replace(url, "").trim().slice(0, 120);
      (draft as Suggestion & { websiteUrl: string }).websiteUrl = url;
    }
    res.json({
      reply:
        typeof result.reply === "string"
          ? result.reply.trim().slice(0, 2000)
          : "I prepared a response.",
      draft,
    });
  } catch (error) {
    res
      .status(
        error instanceof Error && error.message.startsWith("Configure")
          ? 503
          : 502,
      )
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Could not reach the assistant right now.",
      });
  }
});

export default router;
