import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Test/member accounts (see src/lib/password.ts for the hashing scheme). The
// "admin" account is not stored here — it authenticates against TEAM_PASSWORD
// (see src/app/api/auth/login/route.ts) and has access to every interview.
export const users = sqliteTable("users", {
  username: text("username").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const calendarEvents = sqliteTable("calendar_events", {
  id: text("id").primaryKey(),
  intervieweeName: text("interviewee_name").notNull(),
  publishDate: text("publish_date").notNull(), // ISO date, e.g. "2026-08-24"
  memo: text("memo"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const interviews = sqliteTable("interviews", {
  id: text("id").primaryKey(),
  intervieweeName: text("interviewee_name").notNull(),
  status: text("status", { enum: ["draft", "complete"] })
    .notNull()
    .default("draft"),
  // Structured article content (title, subtitle, intro, bio, sections, outro) — see src/lib/article.ts
  articleJson: text("article_json").notNull(),
  // "확인 필요 항목" list — see src/lib/article.ts NeedsCheckItem[]
  needsCheckJson: text("needs_check_json").notNull().default("[]"),
  // "AI가 수정한 부분" summary shown once after generation — see src/lib/article.ts RevisionSummary
  revisionSummaryJson: text("revision_summary_json").notNull().default("{}"),
  // Owning account's username. Null for interviews created before per-user
  // login existed — those are admin-only (see src/lib/auth.ts canAccessInterview).
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type CalendarEventRow = typeof calendarEvents.$inferSelect;
export type InterviewRow = typeof interviews.$inferSelect;
