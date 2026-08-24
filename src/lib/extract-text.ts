import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

// pdf-parse (via pdfjs-dist) normally spawns/dynamically imports a separate
// worker script on first use. Next.js's bundler doesn't emit that file as a
// standalone chunk, so the dynamic import 404s ("Setting up fake worker
// failed"). Registering the worker module on globalThis makes pdfjs-dist run
// parsing on the main thread instead, skipping that broken import entirely.
(globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

export const ALLOWED_TRANSCRIPT_EXTENSIONS = [".txt", ".docx"];
export const ALLOWED_QUESTIONNAIRE_EXTENSIONS = [".docx", ".pdf", ".txt"];

export class UnsupportedFileTypeError extends Error {
  constructor(fileName: string, allowed: string[]) {
    super(`지원하지 않는 파일 형식입니다: ${fileName} (허용 형식: ${allowed.join(", ")})`);
    this.name = "UnsupportedFileTypeError";
  }
}

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

/** 서버사이드에서 .txt/.docx/.pdf 파일의 본문 텍스트를 추출한다. */
export async function extractText(fileName: string, buffer: Buffer, allowed: string[]): Promise<string> {
  const ext = extensionOf(fileName);
  if (!allowed.includes(ext)) {
    throw new UnsupportedFileTypeError(fileName, allowed);
  }

  switch (ext) {
    case ".txt":
      return buffer.toString("utf-8");
    case ".docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case ".pdf": {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }
    default:
      throw new UnsupportedFileTypeError(fileName, allowed);
  }
}
