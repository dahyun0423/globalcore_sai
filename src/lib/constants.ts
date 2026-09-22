import type { PinSource, Region, Respondent, SlotType } from "./types";

/** 타임라인 범위: 12:00 ~ 21:00, 30분 단위 */
export const START_HOUR = 12;
export const END_HOUR = 21;
export const SLOT_MINUTES = 30;
export const SLOT_COUNT = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;

export function slotLabel(i: number): string {
  const m = START_HOUR * 60 + i * SLOT_MINUTES;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

export function timeToSlot(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]) - START_HOUR * 60;
  return Math.max(0, Math.min(SLOT_COUNT, Math.round(minutes / SLOT_MINUTES)));
}

export const SLOT_TYPES: {
  type: SlotType;
  label: string;
  hint: string;
  color: string;
  unattended: boolean;
}[] = [
  { type: "school", label: "학교", hint: "늘봄·방과후 포함", color: "#b0b8c1", unattended: false },
  { type: "public", label: "공적 돌봄", hint: "다함께돌봄·지역아동센터·課後照顧", color: "#16a34a", unattended: false },
  { type: "private", label: "학원", hint: "학원·安親班·補習班", color: "#3182f6", unattended: false },
  { type: "neighbor", label: "이웃·가족", hint: "수눌음·조부모·里 이웃", color: "#eab308", unattended: false },
  { type: "move", label: "혼자 이동", hint: "어른 없이 이동", color: "#f97316", unattended: true },
  { type: "alone", label: "혼자", hint: "어른 없음 = 공백", color: "#f04452", unattended: true },
];

export const SLOT_META = Object.fromEntries(
  SLOT_TYPES.map((s) => [s.type, s]),
) as Record<SlotType, (typeof SLOT_TYPES)[number]>;

export const REGIONS: { value: Region; label: string; center: [number, number] }[] = [
  { value: "jeju", label: "제주", center: [33.4996, 126.5312] },
  { value: "taiwan", label: "대만", center: [25.033, 121.5654] },
  { value: "seoul", label: "서울(성북)", center: [37.6106, 127.0056] },
];
export const REGION_LABEL = Object.fromEntries(
  REGIONS.map((r) => [r.value, r.label]),
) as Record<Region, string>;

export const RESPONDENTS: { value: Respondent; label: string }[] = [
  { value: "parent", label: "학부모" },
  { value: "teacher", label: "돌봄교사" },
  { value: "resident", label: "주민·이웃" },
  { value: "agency", label: "기관 담당자" },
];
export const RESPONDENT_LABEL = Object.fromEntries(
  RESPONDENTS.map((r) => [r.value, r.label]),
) as Record<Respondent, string>;

export const PIN_SOURCES: { value: PinSource; label: string; color: string }[] = [
  { value: "parent", label: "학부모 응답", color: "#f04452" },
  { value: "observer", label: "팀 관찰", color: "#7c3aed" },
  { value: "agency", label: "기관 데이터", color: "#0f766e" },
];
export const PIN_SOURCE_META = Object.fromEntries(
  PIN_SOURCES.map((p) => [p.value, p]),
) as Record<PinSource, (typeof PIN_SOURCES)[number]>;

export const PIN_TAGS = [
  "차량 과속",
  "보도 없음",
  "골목 사각",
  "조도 낮음",
  "공사",
  "불법주정차",
  "인적 드묾",
  "횡단 위험",
  "기타",
];

/** 멘토링 자료의 핵심 인터뷰 질문 */
export const CORE_QUESTIONS = [
  "하루 중 아이가 가장 무방비한 시간과 장소는 언제, 어디인가요?",
  "제도가 있어도 여전히 남는 문제는요? 돌봄·안전에 드는 돈·거리·시간은?",
  "(지도를 보여주며) 가장 위험한 통학 지점을 표시해 주실 수 있나요?",
  "이웃에게 아이를 맡길 수 있나요? 없다면 이유는요?",
];

export const OTHER_QUESTION_LABEL = "기타·자유 발언";

export const SPEECH_LANGS: { value: string; label: string }[] = [
  { value: "ko-KR", label: "한국어" },
  { value: "zh-TW", label: "中文(臺灣)" },
  { value: "en-US", label: "English" },
];

/** 인터뷰 대상자에게 보여줄 서비스 컨셉 */
export const CONCEPTS: { id: string; title: string; oneLine: string }[] = [
  { id: "gap", title: "우리 아이 돌봄공백 보기", oneLine: "하루 일정을 넣으면 어른 없는 시간이 보이고, 그 시간에 갈 수 있는 돌봄 기관을 알려줘요" },
  { id: "route", title: "안심 통학길", oneLine: "부모들이 찍은 위험지점을 피해서, 안심 거점(지킴이집 등)을 잇는 길을 추천해요" },
  { id: "alert", title: "무소식이 희소식 알림", oneLine: "평소엔 알림이 없고, 정해진 시간에 도착하지 않았을 때만 한 번 알려줘요" },
  { id: "neighbor", title: "이웃 돌봄 품앗이", oneLine: "공백 시간이 서로 다른 이웃 부모끼리 아이 돌봄을 나눠요 (수눌음)" },
];
