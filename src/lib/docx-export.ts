import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
  convertInchesToTwip,
} from "docx";
import type { ArticleContent } from "./article";

const BORDER_GRAY = "999999";
const BOX_FILL = "F2F2F2";

function italicBorderedParagraphs(paragraphs: string[]): Paragraph[] {
  return paragraphs
    .filter((p) => p.trim().length > 0)
    .map(
      (text) =>
        new Paragraph({
          spacing: { after: 160 },
          indent: { left: convertInchesToTwip(0.25) },
          border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: BORDER_GRAY, space: 8 },
          },
          children: [new TextRun({ text, italics: true })],
        }),
    );
}

function bioBox(bio: string): Paragraph[] {
  const lines = bio.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const children: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push(new TextRun({ text: "", break: 1 }));
    children.push(new TextRun({ text: line }));
  });

  const boxBorder = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 8 };
  return [
    new Paragraph({
      spacing: { before: 200, after: 240 },
      shading: { fill: BOX_FILL },
      border: { top: boxBorder, bottom: boxBorder, left: boxBorder, right: boxBorder },
      children: [new TextRun({ text: "약력", bold: true }), new TextRun({ text: "", break: 1 }), ...children],
    }),
  ];
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_GRAY, space: 4 } },
    children: [new TextRun({ text })],
  });
}

function qaParagraphs(question: string, answer: string, isExtra: boolean): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [
        new TextRun({ text: "Q. ", bold: true }),
        new TextRun({ text: question, bold: true }),
        ...(isExtra ? [new TextRun({ text: "  [현장 추가 질문]", italics: true, size: 18, color: "888888" })] : []),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: "A. " }), new TextRun({ text: answer })],
    }),
  ];
}

export function buildArticleDocx(article: ArticleContent): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 60 },
      children: [new TextRun({ text: article.title })],
    }),
    new Paragraph({
      spacing: { after: 320 },
      children: [new TextRun({ text: article.subtitle, bold: true, color: "666666" })],
    }),
  );

  children.push(...italicBorderedParagraphs(article.intro));
  children.push(...bioBox(article.bio));

  for (const section of article.sections) {
    children.push(sectionHeading(section.heading));
    for (const qa of section.qa) {
      children.push(...qaParagraphs(qa.question, qa.answer, qa.isExtra ?? false));
    }
  }

  if (article.outro.length > 0) {
    children.push(new Paragraph({ spacing: { before: 240 }, children: [] }));
    children.push(...italicBorderedParagraphs(article.outro));
  }

  children.push(
    new Paragraph({ spacing: { before: 480 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 8 } }, children: [] }),
    new Paragraph({
      spacing: { before: 200 },
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Interviewer  " }), new TextRun({ text: "________________" })],
    }),
    new Paragraph({
      spacing: { before: 100 },
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Editor & Writer  " }), new TextRun({ text: "________________" })],
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) }, // A4
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export function docxFileName(intervieweeName: string): string {
  return `[대신만나드립니다]_${intervieweeName}_인터뷰.docx`;
}
