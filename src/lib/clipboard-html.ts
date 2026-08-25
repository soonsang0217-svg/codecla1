import { splitParagraphs, type ArticleContent } from "./article";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function paragraphs(text: string): string {
  return splitParagraphs(text)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n");
}

/**
 * Rich-text HTML for clipboard paste into the Brunch editor — headings and
 * bold survive a paste as formatted text, not raw markdown syntax.
 */
export function articleToClipboardHtml(article: ArticleContent): string {
  const parts: string[] = [];
  parts.push(`<h1>${escapeHtml(article.title)}</h1>`);
  parts.push(`<h3>${escapeHtml(article.subtitle)}</h3>`);
  parts.push(paragraphs(article.intro));

  if (article.bio.trim()) {
    parts.push(
      `<p><strong>[약력]</strong><br>${escapeHtml(article.bio).replace(/\r?\n/g, "<br>")}</p>`,
    );
  }

  for (const section of article.sections) {
    parts.push(`<h2>${escapeHtml(section.heading)}</h2>`);
    for (const qa of section.qa) {
      parts.push(`<p><strong>Q. ${escapeHtml(qa.question)}</strong></p>`);
      parts.push(`<p>A. ${escapeHtml(qa.answer)}</p>`);
    }
  }

  if (article.outro.trim()) {
    parts.push(paragraphs(article.outro));
  }

  return parts.filter(Boolean).join("\n");
}
