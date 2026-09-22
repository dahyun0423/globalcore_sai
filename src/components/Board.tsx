"use client";

import { CONCEPTS, REGIONS, REGION_LABEL, SLOT_COUNT, SLOT_TYPES, slotLabel } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { regionStats, tagCounts, type RegionStats } from "@/lib/stats";
import { compareRegions } from "@/lib/summary";
import { Card, SectionTitle } from "./ui";

export function Board() {
  const { data } = useStore();
  const regions = REGIONS.map((r) => r.value).filter(
    (r) => r !== "seoul" || data.interviews.some((i) => i.region === "seoul"),
  );
  const stats = regions.map((r) => regionStats(data.interviews, r));

  return (
    <div className="px-4 pb-6">
      <div className="mt-2 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <Card key={s.region} className="p-3">
            <p className="text-[13px] font-semibold text-ink-3">{REGION_LABEL[s.region]}</p>
            <p className="mt-0.5 text-[28px] font-bold tabular-nums">
              {s.count}
              <span className="ml-1 text-[14px] font-medium text-ink-3">건</span>
            </p>
            <p className="text-[13px] text-ink-2">
              평균 공백{" "}
              <b className="text-danger">{s.avgGap === null ? "—" : `${s.avgGap}분`}</b>
            </p>
          </Card>
        ))}
      </div>

      <SectionTitle>시간대별 공백 (그 시간에 어른이 없던 비율)</SectionTitle>
      <Card>
        {stats.map((s) => (
          <GapStrip key={s.region} s={s} />
        ))}
        <div className="mt-1 flex justify-between pl-14 text-[11px] text-ink-3">
          {[0, 6, 12, 18].map((i) => (
            <span key={i}>{slotLabel(i)}</span>
          ))}
        </div>
      </Card>

      <SectionTitle>돌봄 구성 (칠한 칸 기준)</SectionTitle>
      <Card className="space-y-3">
        {stats.map((s) => (
          <div key={s.region}>
            <p className="mb-1 text-[13px] font-semibold">{REGION_LABEL[s.region]}</p>
            <div className="flex h-5 overflow-hidden rounded-md bg-grey-100">
              {SLOT_TYPES.map((t) =>
                s.mix[t.type] > 0 ? (
                  <div key={t.type} style={{ width: `${s.mix[t.type] * 100}%`, background: t.color }} />
                ) : null,
              )}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
          {SLOT_TYPES.map((t) => (
            <span key={t.type} className="flex items-center gap-1 text-[12px] text-ink-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
              {t.label}
            </span>
          ))}
        </div>
      </Card>

      <SectionTitle>학원 역설 · 이웃 신뢰</SectionTitle>
      <Card className="space-y-3">
        {stats.map((s) => (
          <div key={s.region} className="text-[14px]">
            <p className="font-semibold">{REGION_LABEL[s.region]}</p>
            <p className="text-ink-2">
              학원을 돌봄 때문에: 네 {s.privateForCare.yes} · 일부 {s.privateForCare.partly} · 아니요 {s.privateForCare.no}
            </p>
            <p className="text-ink-2">
              이웃에 맡길 수 있음: 네 {s.neighborTrust.yes} · 경우에 따라 {s.neighborTrust.partly} · 아니요{" "}
              {s.neighborTrust.no}
            </p>
          </div>
        ))}
      </Card>

      <SectionTitle>서비스 컨셉 반응</SectionTitle>
      <Card className="divide-y divide-line py-1">
        {CONCEPTS.map((c) => {
          const fbs = data.interviews.map((i) => i.feedback?.[c.id]?.reaction).filter(Boolean);
          const n = (r: string) => fbs.filter((x) => x === r).length;
          return (
            <div key={c.id} className="flex items-center justify-between py-2.5 text-[14px]">
              <span className="font-medium">{c.title}</span>
              <span className="tabular-nums text-ink-2">
                🙆 {n("want")} · 🤔 {n("maybe")} · 🙅 {n("no")}
              </span>
            </div>
          );
        })}
      </Card>

      <SectionTitle>위험지점 태그</SectionTitle>
      <Card>
        {regions.map((r) => {
          const tc = tagCounts(data.pins.filter((p) => p.region === r));
          return (
            <div key={r} className="mb-2 last:mb-0">
              <p className="text-[13px] font-semibold">{REGION_LABEL[r]}</p>
              <p className="text-[14px] text-ink-2">{tc.length ? tc.map(([t, n]) => `${t} ${n}`).join(" · ") : "아직 없음"}</p>
            </div>
          );
        })}
      </Card>

      <CompareCard />
    </div>
  );
}

function GapStrip({ s }: { s: RegionStats }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-12 shrink-0 text-[13px] font-semibold">{REGION_LABEL[s.region]}</span>
      <div className="flex h-7 flex-1 gap-[1px] overflow-hidden rounded-md">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <div
            key={i}
            className="flex-1"
            title={`${slotLabel(i)} ${Math.round(s.gapBySlot[i] * 100)}%`}
            style={{ background: `rgba(220,38,38,${0.08 + s.gapBySlot[i] * 0.92})` }}
          />
        ))}
      </div>
    </div>
  );
}

function CompareCard() {
  const { data } = useStore();
  // 숫자만 모아 자동으로 만든다 (AI·인터넷 없음). 해석은 팀이 쓴다
  const cmp = compareRegions(data.interviews, data.pins);

  return (
    <>
      <SectionTitle>제주 vs 대만 비교표 (자동)</SectionTitle>
      <Card>
        <p className="text-[14px] text-ink-2">
          인터뷰·하루 그리기·위험지점 숫자를 자동으로 모은 결과보고서용 비교표예요. &ldquo;왜 다른가&rdquo;는 이 표를
          보고 팀이 직접 써요.
        </p>
      </Card>
      <div className="mt-3 space-y-3">
          <Card className="p-3">
            <p className="text-[13px] font-semibold text-ink-3">숫자로 보이는 차이</p>
            <p className="mt-1 text-[15px] leading-relaxed">{cmp.insight}</p>
          </Card>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-2 text-ink-3">
                <tr>
                  <th className="p-2.5 font-semibold">기준</th>
                  <th className="p-2.5 font-semibold">제주</th>
                  <th className="p-2.5 font-semibold">대만</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {cmp.differences.map((d, i) => (
                  <tr key={i}>
                    <td className="p-2.5 font-semibold">{d.axis}</td>
                    <td className="p-2.5">{d.jeju}</td>
                    <td className="p-2.5">{d.taiwan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="space-y-2 p-3 text-[14px]">
            <div>
              <p className="text-[13px] font-semibold text-ink-3">공통점</p>
              {cmp.commonalities.map((c, i) => (
                <p key={i}>· {c}</p>
              ))}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-ink-3">다음에 확인할 질문</p>
              {cmp.openQuestions.map((c, i) => (
                <p key={i}>· {c}</p>
              ))}
            </div>
          </Card>
      </div>
    </>
  );
}
