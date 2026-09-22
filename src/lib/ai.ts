import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

export const MODEL = "claude-opus-5";

const PROJECT_CONTEXT = `당신은 대학생 연구팀 '혼자옵서예'의 현장 리서치 정리를 돕습니다.
연구 주제: 지역별 아동 돌봄공백·통학안전 대응 비교.
비교축: 제주(공적 돌봄 — 다함께돌봄센터·지역아동센터, 마을돌봄 '수눌음돌봄공동체') vs 대만(민간 방과후 돌봄 — 安親班·課後照顧, 里 단위 커뮤니티).
출발점: 서울 성북구에서 확인한 '하교 후 학원 사이 이동 공백'과, 학원만 이용하는 가구의 돌봄공백률이 오히려 높다는 연구(학원 역설).

원칙:
- 메모에 실제로 적힌 내용만 정리합니다. 메모에 없는 사실·수치·일반론을 채워 넣지 않습니다. 해당 내용이 없으면 빈 배열이나 "unknown"으로 둡니다.
- quotes에는 메모의 문장을 고치지 않고 그대로 옮깁니다.
- 결과는 한국어로 씁니다. 대만 인터뷰 메모가 중국어·영어여도 한국어로 정리하되, 고유명사(安親班 등)는 원문 표기를 유지합니다.
- 메모의 [전화번호] [학교] 같은 가림 표시는 그대로 둡니다.`;

export const AnalysisSchema = z.object({
  perQuestion: z
    .array(z.object({ question: z.string(), summary: z.string() }))
    .describe("질문별 답변 요약. 받아쓰기가 있는 질문만. 받아쓰기의 오인식은 문맥상 명확할 때만 바로잡는다"),
  gapTimes: z
    .array(z.string())
    .describe("아이가 어른 없이 보내는 시간대나 상황. 예: '하교 13:00~13:30 학원 이동'"),
  careMeans: z
    .array(
      z.object({
        kind: z.string().describe("공적 돌봄 / 학원 / 이웃·가족 / 기타"),
        detail: z.string(),
        cost: z.string().nullable().describe("메모에 비용이 있으면 원문 그대로, 없으면 null"),
      }),
    )
    .describe("이용 중인 돌봄 수단"),
  riskPlaces: z
    .array(z.object({ place: z.string(), reason: z.string() }))
    .describe("응답자가 위험하다고 말한 통학 장소와 이유"),
  neighborTrust: z.object({
    canEntrust: z.enum(["yes", "partly", "no", "unknown"]),
    reason: z.string(),
  }),
  remainingProblems: z.array(z.string()).describe("제도가 있어도 남는 문제"),
  quotes: z.array(z.string()).describe("인상적인 발언 원문 1~3개"),
  tags: z.array(z.string()).describe("짧은 키워드 3~6개"),
});

export const ComparisonSchema = z.object({
  commonalities: z.array(z.string()),
  differences: z.array(
    z.object({
      axis: z.string().describe("비교 기준. 예: 공백 시간대, 돌봄 주체, 비용, 이웃 신뢰"),
      jeju: z.string(),
      taiwan: z.string(),
    }),
  ),
  insight: z.string().describe("'왜 다른가'에 대한 가설 2~4문장. 표본이 작으면 그 한계를 문장 안에 밝힌다"),
  openQuestions: z.array(z.string()).describe("다음 인터뷰에서 확인해야 할 질문"),
});

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export class AIUnavailable extends Error {}

async function run<T extends z.ZodType>(schema: T, userText: string): Promise<z.infer<T>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AIUnavailable("ANTHROPIC_API_KEY가 설정되지 않았습니다 (.env.local 확인).");
  }
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: PROJECT_CONTEXT,
    messages: [{ role: "user", content: userText }],
    output_config: { format: betaZodOutputFormat(schema) },
  });
  if (response.stop_reason === "refusal") {
    throw new Error("AI가 이 요청을 처리하지 않았습니다. 메모 내용을 확인해 주세요.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("AI 응답을 끝까지 받지 못했습니다. 다시 시도해 주세요.");
  }
  return response.parsed_output as z.infer<T>;
}

export function analyzeInterview(input: {
  region: string;
  respondent: string;
  place: string;
  timelineSummary: string;
  answers: { question: string; text: string }[];
  notes: string;
}) {
  const answered = input.answers.filter((a) => a.text.trim());
  return run(
    AnalysisSchema,
    `아래 인터뷰 1건을 정리해 주세요.

지역: ${input.region}
응답자: ${input.respondent}
장소: ${input.place || "(미기재)"}
타임라인 요약(현장에서 함께 칠한 것): ${input.timelineSummary || "(없음)"}

<질문별_받아쓰기>
${answered.length ? answered.map((a) => `[질문] ${a.question}\n${a.text}`).join("\n\n") : "(없음)"}
</질문별_받아쓰기>

<면접자_메모>
${input.notes || "(없음)"}
</면접자_메모>

받아쓰기는 음성 자동 인식이라 오타·띄어쓰기 오류가 있을 수 있습니다.`,
  );
}

export function compareRegions(payload: unknown) {
  return run(
    ComparisonSchema,
    `아래는 제주와 대만에서 모은 인터뷰 집계와 인터뷰별 정리 결과입니다.
두 지역을 비교해 결과보고서 초안에 쓸 비교표를 만들어 주세요.
데이터에 있는 내용만 근거로 삼고, 한쪽 지역 데이터가 비어 있으면 그 칸에는 "데이터 없음"이라고 쓰세요.

<데이터>
${JSON.stringify(payload, null, 2)}
</데이터>`,
  );
}
