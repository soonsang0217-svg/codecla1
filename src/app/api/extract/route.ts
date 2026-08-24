import { NextRequest, NextResponse } from "next/server";
import {
  extractText,
  UnsupportedFileTypeError,
  ALLOWED_TRANSCRIPT_EXTENSIONS,
  ALLOWED_QUESTIONNAIRE_EXTENSIONS,
} from "@/lib/extract-text";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const kind = formData?.get("kind");

  if (!(file instanceof File) || (kind !== "transcript" && kind !== "questionnaire")) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const allowed = kind === "transcript" ? ALLOWED_TRANSCRIPT_EXTENSIONS : ALLOWED_QUESTIONNAIRE_EXTENSIONS;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(file.name, buffer, allowed);
    return NextResponse.json({ text, fileName: file.name });
  } catch (err) {
    if (err instanceof UnsupportedFileTypeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Text extraction failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "파일에서 텍스트를 추출하지 못했습니다", detail }, { status: 500 });
  }
}
