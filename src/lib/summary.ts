/*
 * AI 없이 폰 안에서 바로 만드는 인터뷰 요약·지역 비교.
 * - 숫자·선택지(하루 그리기, 학원 역설, 이웃 신뢰, 비용)는 입력한 값을 그대로 정리한다
 * - 말(받아쓰기)은 요약해서 바꾸지 않고, 문장을 골라 원문 그대로 옮긴다
 * 그래서 지어낸 내용이 없다. 해석("왜 그런가")은 팀이 직접 쓴다.
 */
import { CORE_QUESTIONS, REGION_LABEL, SLOT_META, SLOT_TYPES, slotLabel } from "./constants";
import { gapMinutes, moveCount, regionStats, tagCounts } from "./stats";
import type { Analysis, Comparison, Interview, Pin, Region, SlotType } from "./types";

const QUESTION_SHORT = ["무방비 시간·장소", "제도가 있어도 남는 문제·비용", "위험한 통학 지점", "이웃에게 맡기기", "기타"];

/** 받아쓰기에서 찾을 키워드 → 태그 */
const KEYWORDS: [RegExp, string][] = [
  [/보도|인도|갓길/, "보도 없음"],
  [/과속|쌩쌩|빨리 달/, "차량 과속"],
  [/골목|사각|안 보/, "골목 사각"],
  [/어둡|깜깜|가로등|조명/, "조도 낮음"],
  [/공사/, "공사"],
  [/주차|학원차|승합차/, "불법주정차"],
  [/사람이 없|인적|한적/, "인적 드묾"],
  [/횡단|건너|신호/, "횡단 위험"],
  [/퇴근|야근|근무|회사/, "부모 근무시간"],
  [/학원/, "학원"],
  [/센터|지역아동|다함께|돌봄교실|늘봄|安親|課後/, "공적·기관 돌봄"],
  [/비싸|부담|돈|비용|만원/, "비용 부담"],
  [/미안|눈치|부탁/, "부탁의 부담"],
  [/걱정|불안|무섭|겁/, "불안"],
];
const FEELING = /걱정|불안|무섭|겁|미안|힘들|부담|비싸|속상|죄책/;

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.?!。？！])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function firstSentences(text: string, n: number, max = 140): string {
  const out = sentences(text).slice(0, n).join(" ");
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

function label(s: SlotType | null | undefined): string {
  return s ? SLOT_META[s].label : "기록 없음";
}

/** 어른 없는 구간을 "앞 → 뒤 사이"와 함께 적는다. 틈이 어느 기관 사이에 생기는지가 핵심 */
function gapSegments(slots: (SlotType | null)[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < slots.length) {
    const s = slots[i];
    if (!s || !SLOT_META[s].unattended) {
      i++;
      continue;
    }
    let j = i;
    while (j < slots.length && slots[j] === s) j++;
    const before = slots.slice(0, i).reverse().find((x) => x && !SLOT_META[x].unattended);
    const after = slots.slice(j).find((x) => x && !SLOT_META[x].unattended);
    const between = before || after ? ` (${label(before)} → ${label(after)} 사이)` : "";
    out.push(`${slotLabel(i)}~${slotLabel(j)} ${SLOT_META[s].label}${between}`);
    i = j;
  }
  return out;
}

function careSegments(slots: (SlotType | null)[], monthlyCost: string): Analysis["careMeans"] {
  const byType = new Map<SlotType, string[]>();
  let i = 0;
  while (i < slots.length) {
    const s = slots[i];
    let j = i + 1;
    while (j < slots.length && slots[j] === s) j++;
    if (s && !SLOT_META[s].unattended && s !== "school") {
      byType.set(s, [...(byType.get(s) ?? []), `${slotLabel(i)}~${slotLabel(j)}`]);
    }
    i = j;
  }
  const means = [...byType.entries()].map(([s, ranges]) => ({
    kind: SLOT_META[s].label,
    detail: ranges.join(", "),
    cost: null as string | null,
  }));
  if (monthlyCost.trim()) means.push({ kind: "한 달 비용", detail: monthlyCost.trim(), cost: null });
  return means;
}

export function summarizeInterview(iv: Interview): Analysis {
  const answers = iv.answers.map((a) => a ?? "");
  const allText = [...answers, iv.notes].join("\n");

  const perQuestion = answers
    .map((text, i) => ({ question: QUESTION_SHORT[i] ?? CORE_QUESTIONS[i] ?? "기타", summary: firstSentences(text, 2) }))
    .filter((p) => p.summary);

  const q3 = answers[2] ?? "";
  const q3Tags = KEYWORDS.slice(0, 8).filter(([re]) => re.test(q3)).map(([, t]) => t);
  const riskPlaces = q3.trim() ? [{ place: firstSentences(q3, 1, 80).replace(/[.。]+$/, ""), reason: q3Tags.join(", ") || "이유 언급 없음" }] : [];

  const trustMap = { yes: "yes", partly: "partly", no: "no" } as const;
  const neighborTrust = {
    canEntrust: iv.neighborTrust ? trustMap[iv.neighborTrust] : ("unknown" as const),
    reason: firstSentences(answers[3] ?? "", 1, 100) || "이유 기록 없음",
  };

  const remainingProblems = sentences(answers[1] ?? "").slice(0, 3);

  const quoteCandidates = sentences(allText).filter((s) => s.length >= 8);
  const quotes = [...quoteCandidates.filter((s) => FEELING.test(s)), ...quoteCandidates]
    .filter((s, k, arr) => arr.indexOf(s) === k)
    .slice(0, 2);

  const tags = new Set<string>();
  if (moveCount(iv.slots) > 0) tags.add("혼자 이동 있음");
  if (iv.slots.includes("alone")) tags.add("혼자 있는 시간 있음");
  if (iv.privateForCare === "yes" || iv.privateForCare === "partly") tags.add("학원=돌봄 목적");
  for (const [re, t] of KEYWORDS) if (re.test(allText)) tags.add(t);

  return {
    perQuestion,
    gapTimes: gapSegments(iv.slots),
    careMeans: careSegments(iv.slots, iv.monthlyCost),
    riskPlaces,
    neighborTrust,
    remainingProblems,
    quotes,
    tags: [...tags].slice(0, 8),
    analyzedAt: new Date().toISOString(),
  };
}

/* ---------------- 지역 비교 ---------------- */

const pct = (v: number) => `${Math.round(v * 100)}%`;

function peakHours(gapBySlot: number[], n = 2): string {
  const ranked = gapBySlot
    .map((v, i) => [v, i] as const)
    .filter(([v]) => v > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, n);
  return ranked.length ? ranked.map(([v, i]) => `${slotLabel(i)} (${pct(v)})`).join(", ") : "—";
}

function mixText(mix: Record<SlotType, number>): string {
  return SLOT_TYPES.filter((t) => mix[t.type] > 0)
    .sort((a, b) => mix[b.type] - mix[a.type])
    .map((t) => `${t.label} ${pct(mix[t.type])}`)
    .join(" · ") || "—";
}

const tally = (t: { yes: number; partly: number; no: number }) => `네 ${t.yes} · 일부 ${t.partly} · 아니요 ${t.no}`;

export function compareRegions(interviews: Interview[], pins: Pin[], a: Region = "jeju", b: Region = "taiwan"): Comparison {
  const [sa, sb] = [regionStats(interviews, a), regionStats(interviews, b)];
  const [ta, tb] = [tagCounts(pins.filter((p) => p.region === a)), tagCounts(pins.filter((p) => p.region === b))];
  const gapsOf = (r: Region) => interviews.filter((i) => i.region === r && i.slots.some(Boolean)).map((i) => gapMinutes(i.slots));

  const differences = [
    { axis: "인터뷰 수", jeju: `${sa.count}건`, taiwan: `${sb.count}건` },
    { axis: "평균 어른 없는 시간", jeju: sa.avgGap === null ? "—" : `${sa.avgGap}분`, taiwan: sb.avgGap === null ? "—" : `${sb.avgGap}분` },
    { axis: "공백이 몰리는 시간", jeju: peakHours(sa.gapBySlot), taiwan: peakHours(sb.gapBySlot) },
    { axis: "하루 돌봄 구성", jeju: mixText(sa.mix), taiwan: mixText(sb.mix) },
    { axis: "학원을 돌봄 목적으로", jeju: tally(sa.privateForCare), taiwan: tally(sb.privateForCare) },
    { axis: "이웃에게 맡길 수 있다", jeju: tally(sa.neighborTrust), taiwan: tally(sb.neighborTrust) },
    {
      axis: "많이 나온 위험 태그",
      jeju: ta.slice(0, 3).map(([t, n]) => `${t} ${n}`).join(", ") || "—",
      taiwan: tb.slice(0, 3).map(([t, n]) => `${t} ${n}`).join(", ") || "—",
    },
  ];

  const commonalities: string[] = [];
  if (gapsOf(a).some((g) => g > 0) && gapsOf(b).some((g) => g > 0))
    commonalities.push(`두 지역 모두 어른 없는 시간이 기록됐다 (${REGION_LABEL[a]} 평균 ${sa.avgGap}분 · ${REGION_LABEL[b]} 평균 ${sb.avgGap}분)`);
  const topSlot = (g: number[]) => g.indexOf(Math.max(...g));
  if (sa.filled && sb.filled && Math.max(...sa.gapBySlot) > 0 && topSlot(sa.gapBySlot) === topSlot(sb.gapBySlot))
    commonalities.push(`공백이 가장 많은 시간이 같다: ${slotLabel(topSlot(sa.gapBySlot))}`);
  if (ta[0] && tb[0] && ta[0][0] === tb[0][0]) commonalities.push(`가장 많이 나온 위험 태그가 같다: ${ta[0][0]}`);
  if (!commonalities.length) commonalities.push("아직 겹치는 점이 뚜렷하지 않다 (인터뷰가 더 필요)");

  const bigger = (x: number, y: number) => (x > y ? REGION_LABEL[a] : REGION_LABEL[b]);
  const facts: string[] = [];
  if (sa.filled && sb.filled) {
    facts.push(`공적 돌봄 비중은 ${REGION_LABEL[a]} ${pct(sa.mix.public)} · ${REGION_LABEL[b]} ${pct(sb.mix.public)}`);
    facts.push(`학원 비중은 ${REGION_LABEL[a]} ${pct(sa.mix.private)} · ${REGION_LABEL[b]} ${pct(sb.mix.private)}`);
    const moveA = sa.mix.move, moveB = sb.mix.move;
    if (moveA !== moveB) facts.push(`혼자 이동 비중은 ${bigger(moveA, moveB)} 쪽이 더 크다 (${pct(moveA)} · ${pct(moveB)})`);
  }
  const insight = facts.length
    ? `${facts.join(". ")}. — 숫자만 자동으로 모은 것. "왜 다른가"는 이 표를 보고 팀이 직접 쓴다.`
    : "두 지역 모두 하루 그리기를 한 인터뷰가 있어야 비교할 수 있어요.";

  const openQuestions: string[] = [];
  for (const s of [sa, sb]) if (s.count < 5) openQuestions.push(`${REGION_LABEL[s.region]} 인터뷰가 ${s.count}건 — 비교하려면 더 모아야 한다`);
  const pa = topSlot(sa.gapBySlot);
  if (sa.filled && sa.gapBySlot[pa] > 0) openQuestions.push(`${REGION_LABEL[a]} ${slotLabel(pa)}대에 아이는 실제로 어디에 있나? (걸으며 기록으로 확인)`);
  const pb = topSlot(sb.gapBySlot);
  if (sb.filled && sb.gapBySlot[pb] > 0) openQuestions.push(`${REGION_LABEL[b]} ${slotLabel(pb)}대의 공백은 누가 메우나?`);
  if (sa.privateForCare.yes + sa.privateForCare.partly + sb.privateForCare.yes + sb.privateForCare.partly > 0)
    openQuestions.push("학원을 돌봄 목적으로 보내는 집은 그 사이 이동을 어떻게 해결하나?");

  return { commonalities, differences, insight, openQuestions, generatedAt: new Date().toISOString() };
}
