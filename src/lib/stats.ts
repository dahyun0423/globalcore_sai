import { SLOT_COUNT, SLOT_META, SLOT_MINUTES, SLOT_TYPES } from "./constants";
import type { Interview, Pin, Region, SlotType } from "./types";

export function gapMinutes(slots: (SlotType | null)[]): number {
  return slots.filter((s) => s && SLOT_META[s].unattended).length * SLOT_MINUTES;
}

export function moveCount(slots: (SlotType | null)[]): number {
  let n = 0;
  slots.forEach((s, i) => {
    if (s === "move" && slots[i - 1] !== "move") n++;
  });
  return n;
}

export interface RegionStats {
  region: Region;
  count: number;
  filled: number; // 타임라인을 한 칸이라도 칠한 인터뷰 수
  avgGap: number | null;
  /** 칸별로 공백(혼자/혼자 이동)인 인터뷰 비율 0~1 */
  gapBySlot: number[];
  /** 전체 칠한 칸 중 돌봄 유형 비중 */
  mix: Record<SlotType, number>;
  privateForCare: { yes: number; partly: number; no: number };
  neighborTrust: { yes: number; partly: number; no: number };
}

export function regionStats(interviews: Interview[], region: Region): RegionStats {
  const list = interviews.filter((i) => i.region === region);
  const filled = list.filter((i) => i.slots.some(Boolean));
  const gapBySlot = Array.from({ length: SLOT_COUNT }, (_, k) =>
    filled.length
      ? filled.filter((i) => {
          const s = i.slots[k];
          return s && SLOT_META[s].unattended;
        }).length / filled.length
      : 0,
  );
  const mix = Object.fromEntries(SLOT_TYPES.map((t) => [t.type, 0])) as Record<SlotType, number>;
  let total = 0;
  for (const i of filled)
    for (const s of i.slots)
      if (s) {
        mix[s]++;
        total++;
      }
  if (total) for (const k of Object.keys(mix) as SlotType[]) mix[k] /= total;

  const tally = (key: "privateForCare" | "neighborTrust") => ({
    yes: list.filter((i) => i[key] === "yes").length,
    partly: list.filter((i) => i[key] === "partly").length,
    no: list.filter((i) => i[key] === "no").length,
  });

  return {
    region,
    count: list.length,
    filled: filled.length,
    avgGap: filled.length
      ? Math.round(filled.reduce((a, i) => a + gapMinutes(i.slots), 0) / filled.length)
      : null,
    gapBySlot,
    mix,
    privateForCare: tally("privateForCare"),
    neighborTrust: tally("neighborTrust"),
  };
}

export function tagCounts(pins: Pin[]): [string, number][] {
  const m = new Map<string, number>();
  for (const p of pins) for (const t of p.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
