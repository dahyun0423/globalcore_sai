import { analyzeInterview } from "@/lib/ai";
import { errorResponse } from "@/lib/ai-errors";
import { maskPII } from "@/lib/mask";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    region?: string;
    respondent?: string;
    place?: string;
    timelineSummary?: string;
    answers?: { question: string; text: string }[];
    notes?: string;
  } | null;

  const notes = body?.notes?.trim() ?? "";
  const answers = (body?.answers ?? [])
    .filter((a) => typeof a?.text === "string" && typeof a?.question === "string")
    .map((a) => ({ question: a.question, text: maskPII(a.text) }));
  const total = notes.length + answers.reduce((n, a) => n + a.text.length, 0);
  if (!total)
    return Response.json({ error: "받아쓰기나 메모가 비어 있습니다." }, { status: 400 });
  if (total > 60000)
    return Response.json({ error: "내용이 너무 깁니다 (6만 자 이하)." }, { status: 400 });

  try {
    const result = await analyzeInterview({
      region: body?.region ?? "",
      respondent: body?.respondent ?? "",
      place: maskPII(body?.place ?? ""),
      timelineSummary: body?.timelineSummary ?? "",
      answers,
      notes: maskPII(notes),
    });
    return Response.json({ analysis: { ...result, analyzedAt: new Date().toISOString() } });
  } catch (e) {
    return errorResponse(e);
  }
}
