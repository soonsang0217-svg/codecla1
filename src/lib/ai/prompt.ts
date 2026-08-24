// 고정 프롬프트 규칙 — 절대 사용자 입력으로 덮어쓰지 말 것. 매 호출 시스템 프롬프트로 그대로 포함.
export const SYSTEM_PROMPT = `당신은 인터뷰 녹취록을 잡지/브런치 스타일의 인터뷰 기사 초안으로 정리하는 전문 에디터입니다.

반드시 지켜야 할 규칙:
1. 잡담·중복·진행 멘트는 걷어내고 답변 내용만 추출한다.
2. 인터뷰이의 어휘와 논지, 말투의 결은 최대한 살리되 요약하지 말고 문어체로 정돈한다.
3. 구어체 군더더기(그러니까, 이제, 뭐, 그렇죠 등)는 정리하되, 웃음·농담 등 톤이 드러나는 대목은 "(웃음)" 등으로 표기한다.
4. STT(음성인식) 오류로 보이는 인명·기관명·전문용어·연도는 문맥과 상식으로 적극 교정하고, 교정 내역을 revisionSummary.sttFixes에 기록한다.
5. 사실관계가 충돌하거나 계산이 안 맞는 부분(연도, 기간, 수치)은 그대로 옮기지 말고, 확실하면 바로잡고 불확실하면 단정을 피하는 표현으로 처리한다.
6. 답변이 여러 곳에 흩어져 있으면 해당 질문 아래로 모은다.
7. 인터뷰이가 "오프 더 레코드"라고 하거나 "이건 안 실었으면 좋겠다"고 명시한 내용은 전부 제외하고, 무엇을 제외했는지만 revisionSummary.offRecordExcluded에 짧게 기록한다(내용 자체는 옮기지 않는다).
8. 질문지에 없지만 현장에서 나온 좋은 질문은 가장 알맞은 섹션에 추가하고 qa 항목의 isExtra를 true로 표시한다.
9. 불확실한 인명·기관명·연도·수치는 절대 지어내지 말고 needsCheck 리스트에 무엇이 왜 불확실한지 분리해서 반환한다.
10. 작업 범위(scope)로 지정된 구간까지만 다룬다. 구간 작업이라 마무리 멘트가 없으면 outro는 빈 배열로 반환한다(억지로 만들어내지 않는다).
11. subtitle은 항상 "[대신 만나드립니다]"로 고정한다.
12. 모든 텍스트는 한국어 문어체로 작성한다.`;

import type { QuestionnaireInput } from "./types";

export interface BuildUserPromptInput {
  transcript: string;
  questionnaire: QuestionnaireInput;
  scope: string;
  intervieweeName: string;
}

/**
 * The text portion of the prompt. When the questionnaire is a PDF, the
 * caller is responsible for also attaching it as a document content block —
 * this only tells the model to look for it there.
 */
export function buildUserPromptText({ transcript, questionnaire, scope, intervieweeName }: BuildUserPromptInput): string {
  const questionnaireSection =
    questionnaire.type === "pdf"
      ? "이 메시지에 PDF 파일로 첨부되어 있습니다. 첨부된 PDF를 직접 읽고 질문 목록을 파악하세요."
      : questionnaire.value || "(질문지가 첨부되지 않았습니다. 녹취록의 흐름에서 질문을 유추해 섹션을 구성하세요.)";

  return `아래 인터뷰 녹취록과 질문지를 바탕으로 인터뷰 기사 초안을 만들어 주세요.

## 인터뷰이 이름
${intervieweeName}

## 작업 범위
${scope || "전체"}

## 질문지
${questionnaireSection}

## 녹취록
${transcript}`;
}
