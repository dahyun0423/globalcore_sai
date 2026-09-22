"use client";

import { REGION_LABEL, RESPONDENT_LABEL, SLOT_META } from "@/lib/constants";
import { blankInterview, useStore } from "@/lib/store";
import { gapMinutes } from "@/lib/stats";
import type { Interview } from "@/lib/types";
import { Button, Card } from "./ui";

export function InterviewList({ onOpen }: { onOpen: (i: Interview) => void }) {
  const { data, region } = useStore();
  const list = data.interviews.filter((i) => i.region === region);
  const others = data.interviews.length - list.length;

  return (
    <div className="px-4 pb-6">
      <Button variant="accent" className="mt-2 w-full text-[17px]" onClick={() => onOpen(blankInterview(region))}>
        ＋ 새 인터뷰 ({REGION_LABEL[region]})
      </Button>

      {list.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-[15px] text-ink-2">{REGION_LABEL[region]} 인터뷰가 아직 없어요.</p>
          <p className="mt-1 text-[13px] text-ink-3">
            동의 → 질문·녹음 → 하루 그리기 → 서비스 보여주기 → 요약 순서로 진행돼요.
          </p>
          {others > 0 && <p className="mt-3 text-[13px] text-ink-3">다른 지역 인터뷰 {others}건은 위에서 지역을 바꾸면 보여요.</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {list.map((i) => {
            const gap = gapMinutes(i.slots);
            const answered = i.answers.filter((a) => a.trim()).length;
            return (
              <button key={i.id} type="button" onClick={() => onOpen(i)} className="block w-full text-left">
                <Card className="p-3.5 active:bg-surface-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-semibold">
                      {RESPONDENT_LABEL[i.respondent]}
                      {i.place && <span className="font-normal text-ink-2"> · {i.place}</span>}
                    </span>
                    <span className="text-[12px] text-ink-3">
                      {new Date(i.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-grey-100">
                    {i.slots.map((s, k) => (
                      <div key={k} className="flex-1" style={{ background: s ? SLOT_META[s].color : "transparent" }} />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 text-[13px] text-ink-2">
                    <span>
                      공백 <b className={gap ? "text-danger" : ""}>{gap}분</b>
                    </span>
                    <span>답변 {answered}개</span>
                    {i.audioClips > 0 && <span>녹음 {i.audioClips}</span>}
                    <span className={i.analysis ? "text-accent" : "text-ink-3"}>{i.analysis ? "요약됨" : "정리 전"}</span>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
