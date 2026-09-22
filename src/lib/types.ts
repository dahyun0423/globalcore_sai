export type Region = "jeju" | "taiwan" | "seoul";
export type Respondent = "parent" | "teacher" | "resident" | "agency";
export type PinSource = "parent" | "observer" | "agency";
export type GradeBand = "low" | "high" | "unknown";

/** 한 칸 = 30분. null은 아직 안 칠한 칸 */
export type SlotType =
  | "school"
  | "public"
  | "private"
  | "neighbor"
  | "move"
  | "alone";

export interface Consent {
  explained: boolean; // 연구 목적 설명
  anonymous: boolean; // 익명 처리 안내
  noChild: boolean; // 아동에게 직접 묻지 않음 확인
  recording: boolean; // 녹음·자동 받아쓰기 동의 (선택)
}

export type Reaction = "want" | "maybe" | "no";

export interface ConceptFeedback {
  reaction: Reaction | null;
  comment: string;
}

export interface Analysis {
  perQuestion: { question: string; summary: string }[];
  gapTimes: string[];
  careMeans: { kind: string; detail: string; cost: string | null }[];
  riskPlaces: { place: string; reason: string }[];
  neighborTrust: {
    canEntrust: "yes" | "partly" | "no" | "unknown";
    reason: string;
  };
  remainingProblems: string[];
  quotes: string[];
  tags: string[];
  analyzedAt: string;
}

export interface Interview {
  id: string;
  createdAt: string;
  updatedAt: string;
  region: Region;
  place: string;
  respondent: Respondent;
  gradeBand: GradeBand;
  consent: Consent;
  slots: (SlotType | null)[];
  /** 학원(사적 돌봄)을 돌봄 목적으로 보내는지 — 학원 역설 확인용 */
  privateForCare: "yes" | "partly" | "no" | null;
  monthlyCost: string;
  neighborTrust: "yes" | "partly" | "no" | null;
  /** 질문별 받아쓰기/답변. 인덱스 = CORE_QUESTIONS 순서, 마지막 칸 = 기타 */
  answers: string[];
  audioClips: number;
  /** 서비스 미리보기(컨셉)에 대한 반응 */
  feedback: Record<string, ConceptFeedback>;
  notes: string;
  analysis: Analysis | null;
}

/** 팀 공유 저장소와 맞춰 봤는지. 없으면 아직 올리지 않은 것 */
export interface Syncable {
  updatedAt?: string;
  synced?: boolean;
}

export interface Pin extends Syncable {
  id: string;
  createdAt: string;
  lat: number;
  lng: number;
  region: Region;
  source: PinSource;
  tags: string[];
  memo: string;
  /** 사진 id. 원본은 폰 IndexedDB + 팀 공유 저장소에 있다 */
  photos?: string[];
}

export type RouteKind = "drawn" | "walked";

/** 통학 경로. 지도에 그린 것(drawn) 또는 실제로 걸으며 GPS로 기록한 것(walked) */
export interface Route extends Syncable {
  id: string;
  createdAt: string;
  region: Region;
  kind: RouteKind;
  name: string;
  points: [number, number][];
  distanceM: number;
  /** 걸은 경로만 — 걸린 시간 */
  durationSec?: number;
  memo: string;
}

export interface FieldData {
  version: 1;
  interviews: Interview[];
  pins: Pin[];
  routes: Route[];
}

export interface Comparison {
  commonalities: string[];
  differences: { axis: string; jeju: string; taiwan: string }[];
  insight: string;
  openQuestions: string[];
  generatedAt: string;
}
