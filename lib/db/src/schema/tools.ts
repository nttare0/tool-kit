import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const toolsTable = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  shortDescription: text("short_description").notNull(),
  description: text("description").notNull(),
  howItWorks: text("how_it_works").notNull(),
  bestFor: text("best_for").notNull().default(""),
  websiteUrl: text("website_url").notNull(),
  logoUrl: text("logo_url"),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categoriesTable.id, { onDelete: "restrict" }),
  pricing: text("pricing").notNull(),
  featured: boolean("featured").notNull().default(false),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertToolSchema = createInsertSchema(toolsTable).omit({
  id: true,
  slug: true,
  createdAt: true,
});
export type InsertTool = z.infer<typeof insertToolSchema>;
export type Tool = typeof toolsTable.$inferSelect;