import { logger } from "./logger";
import { all, run, transaction } from "./sqlite";
import { slugify } from "./slugify";

const seedCategories = [
  { name: "AI & Assistants", description: "Thinking partners for research, writing, and building.", accent: "#D8FF63" },
  { name: "Design", description: "A sharper starting point for every visual decision.", accent: "#FF9F68" },
  { name: "Development", description: "Small utilities that keep the code moving.", accent: "#8BE8D5" },
  { name: "Productivity", description: "Calm systems for the work between the work.", accent: "#BBA7FF" },
  { name: "Media", description: "Tools for making, editing, and sharing the signal.", accent: "#FF7B9C" },
];

function screenshotUrl(websiteUrl: string) {
  return `https://api.microlink.io/?url=${encodeURIComponent(websiteUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
}

const seedTools = [
  {
    name: "Claude",
    shortDescription: "A thoughtful AI collaborator for writing, analysis, and making sense of complexity.",
    description: "Claude is an AI assistant that is especially good at long-form reasoning, clear writing, and working through complicated material with you.",
    howItWorks: "Bring a question, document, or rough idea into a conversation. Claude uses the context you provide to draft, analyze, summarize, or help you explore the next move.",
    bestFor: "Writers, researchers, product teams, and builders who want a calm thinking partner.",
    websiteUrl: "https://claude.ai",
    previewUrl: screenshotUrl("https://claude.ai"),
    pricing: "Free plan · Pro available",
    category: "AI & Assistants",
    featured: true,
  },
  {
    name: "Figma",
    shortDescription: "A collaborative canvas for interface design, prototypes, and shared decisions.",
    description: "Figma brings teams into the same design file so ideas can move from rough layout to clickable prototype without a handoff gap.",
    howItWorks: "Design in the browser, invite collaborators, and connect frames with prototype links. Comments and shared libraries keep the work moving in one place.",
    bestFor: "Product designers, founders, and teams shaping digital products together.",
    websiteUrl: "https://www.figma.com",
    previewUrl: screenshotUrl("https://www.figma.com"),
    pricing: "Free plan · Paid teams",
    category: "Design",
    featured: true,
  },
  {
    name: "Excalidraw",
    shortDescription: "A wonderfully simple whiteboard for ideas that are still forming.",
    description: "Excalidraw gives diagrams and early thoughts a hand-drawn quality that keeps them open to change. It is fast, friendly, and shareable without setup.",
    howItWorks: "Open a board, draw with a deliberately imperfect toolkit, and share the canvas with a link. Everything stays lightweight and easy to rearrange.",
    bestFor: "Wireframes, planning sessions, diagrams, and explaining a tricky idea.",
    websiteUrl: "https://excalidraw.com",
    previewUrl: screenshotUrl("https://excalidraw.com"),
    pricing: "Free",
    category: "Design",
    featured: false,
  },
  {
    name: "Raycast",
    shortDescription: "A fast command center for your Mac and the tools around it.",
    description: "Raycast replaces scattered menus and repetitive clicks with a keyboard-first command bar. Extensions connect it to the apps and workflows you already use.",
    howItWorks: "Press the shortcut, search for an action, and run it from one place. Add extensions when a workflow deserves a custom command.",
    bestFor: "Developers, designers, and anyone who lives in keyboard shortcuts.",
    websiteUrl: "https://www.raycast.com",
    previewUrl: screenshotUrl("https://www.raycast.com"),
    pricing: "Free plan · Pro available",
    category: "Productivity",
    featured: false,
  },
];

export function seedDatabase() {
  for (const tool of seedTools) {
    run(
      "UPDATE tools SET preview_url = ? WHERE website_url = ? AND (preview_url IS NULL OR preview_url = ?)",
      tool.previewUrl,
      tool.websiteUrl,
      tool.websiteUrl,
    );
  }
  if (all("SELECT id FROM categories LIMIT 1").length > 0) return;
  transaction(() => {
    const categoryIds = new Map<string, number>();
    for (const category of seedCategories) {
      const result = run(
        "INSERT INTO categories (name, slug, description, accent) VALUES (?, ?, ?, ?)",
        category.name,
        slugify(category.name),
        category.description,
        category.accent,
      );
      categoryIds.set(category.name, Number(result.lastInsertRowid));
    }
    for (const tool of seedTools) {
      run(
        `INSERT INTO tools
         (name, slug, short_description, description, how_it_works, best_for, website_url, logo_url, preview_url, category_id, pricing, featured, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        tool.name,
        slugify(tool.name),
        tool.shortDescription,
        tool.description,
        tool.howItWorks,
        tool.bestFor,
        tool.websiteUrl,
        null,
        tool.previewUrl,
        categoryIds.get(tool.category),
        tool.pricing,
        tool.featured ? 1 : 0,
        "published",
        new Date().toISOString(),
      );
    }
  });
  logger.info({ categoryCount: seedCategories.length, toolCount: seedTools.length }, "Seeded Toolstack SQLite content");
}