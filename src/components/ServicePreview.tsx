"use client";

import { useState } from "react";
import { CONCEPTS, SLOT_META, slotLabel } from "@/lib/constants";
import type { ConceptFeedback, Reaction, SlotType } from "@/lib/types";

/**
 * 인터뷰 대상자에게 폰을 건네서 보여주는 "이런 서비스가 있다면?" 화면.
 * 우리 메모·받아쓰기는 안 보이고, 컨셉 4개를 넘겨 보며 반응을 고른다.
 * 화면의 이름·기관·시간은 전부 예시 데이터.
 */
export function ServicePreview({
  slots,
  feedback,
  onFeedback,
  onClose,
}: {
  slots: (SlotType | null)[];
  feedback: Record<string, ConceptFeedback>;
  onFeedback: (f: Record<string, ConceptFeedback>) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const concept = CONCEPTS[page];
  const fb = feedback[concept.id] ?? { reaction: null, comment: "" };
  const setFb = (patch: Partial<ConceptFeedback>) =>
    onFeedback({ ...feedback, [concept.id]: { ...fb, ...patch } });

  const reactions: { value: Reaction; label: string; emoji: string }[] = [
    { value: "want", label: "쓰고 싶어요", emoji: "🙆" },
    { value: "maybe", label: "글쎄요", emoji: "🤔" },
    { value: "no", label: "필요 없어요", emoji: "🙅" },
  ];

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] flex-col bg-grey-50">
      <div className="pt-safe flex items-center justify-between px-4 pb-2">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
          예시 화면 · 실제 서비스 아님
        </span>
        <button type="button" onClick={onClose} className="px-2 py-1 text-[15px] font-semibold text-ink-2">
          닫기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        <p className="mt-2 text-[14px] font-semibold text-accent">
          {page + 1} / {CONCEPTS.length}
        </p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight">{concept.title}</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{concept.oneLine}</p>

        <div className="mt-5 rounded-[28px] border border-line bg-card p-4 shadow-float">
          {concept.id === "gap" && <GapMock slots={slots} />}
          {concept.id === "route" && <RouteMock />}
          {concept.id === "alert" && <AlertMock />}
          {concept.id === "neighbor" && <NeighborMock />}
        </div>

        <p className="mt-6 text-center text-[17px] font-semibold">이런 게 있다면 쓰시겠어요?</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {reactions.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setFb({ reaction: r.value })}
              className={`flex flex-col items-center gap-1 rounded-card border-2 py-3 ${
                fb.reaction === r.value ? "border-accent bg-accent-soft" : "border-line bg-card"
              }`}
            >
              <span className="text-[28px]">{r.emoji}</span>
              <span className="text-[14px] font-semibold">{r.label}</span>
            </button>
          ))}
        </div>
        <textarea
          value={fb.comment}
          onChange={(e) => setFb({ comment: e.target.value })}
          rows={2}
          placeholder="이유나 바라는 점 (면접자가 받아 적어도 돼요)"
          className="mt-3 w-full resize-none rounded-card border border-line bg-card p-3 text-[16px] outline-none"
        />
        <div className="h-6" />
      </div>

      <div className="pb-safe flex gap-2 border-t border-line bg-card px-4 pt-3">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          className="min-h-[52px] flex-1 rounded-field border border-line text-[16px] font-semibold disabled:opacity-30"
        >
          이전
        </button>
        {page < CONCEPTS.length - 1 ? (
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="min-h-[52px] flex-[2] rounded-field bg-accent text-[16px] font-semibold text-white"
          >
            다음
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[52px] flex-[2] rounded-field bg-ink text-[16px] font-semibold text-white"
          >
            끝 · 면접자에게 돌려주기
          </button>
        )}
      </div>
    </div>
  );
}

function GapMock({ slots }: { slots: (SlotType | null)[] }) {
  // 인터뷰에서 칠한 타임라인이 있으면 그걸 보여주고, 없으면 예시
  const has = slots.some(Boolean);
  const demo: (SlotType | null)[] = [
    "school", "school", "move", "private", "private", "move", "alone", "alone",
    "public", "public", "public", "alone", "alone", "neighbor", "neighbor", "neighbor", null, null,
  ];
  const view = has ? slots : demo;
  const blocks: { type: SlotType; from: number; to: number }[] = [];
  view.forEach((s, i) => {
    if (!s) return;
    const last = blocks[blocks.length - 1];
    if (last && last.type === s && last.to === i) last.to = i + 1;
    else blocks.push({ type: s, from: i, to: i + 1 });
  });
  const gapBlock = blocks.find((b) => SLOT_META[b.type].unattended && b.type === "alone");
  return (
    <div>
      <p className="text-[13px] font-semibold text-ink-3">{has ? "방금 함께 그린 하루" : "오늘 아이의 오후 (예시)"}</p>
      <div className="mt-3 flex h-10 overflow-hidden rounded-xl">
        {view.map((s, i) => (
          <div key={i} className="flex-1" style={{ background: s ? SLOT_META[s].color : "#f1f1f4" }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink-3">
        <span>12시</span>
        <span>15시</span>
        <span>18시</span>
        <span>21시</span>
      </div>
      {gapBlock && (
        <div className="mt-4 rounded-card bg-danger-soft p-3">
          <p className="text-[15px] font-bold text-danger">
            {slotLabel(gapBlock.from)}~{slotLabel(gapBlock.to)} 어른이 없어요
          </p>
          <p className="mt-2 text-[14px] text-ink-2">이 시간에 갈 수 있는 곳</p>
          <div className="mt-2 space-y-2">
            {[
              { name: "○○ 다함께돌봄센터", meta: "도보 6분 · 빈자리 2 · 무료" },
              { name: "△△ 지역아동센터", meta: "도보 11분 · 대기 3명" },
            ].map((c) => (
              <div key={c.name} className="flex items-center justify-between rounded-xl bg-card px-3 py-2.5">
                <div>
                  <p className="text-[15px] font-semibold">{c.name}</p>
                  <p className="text-[13px] text-ink-3">{c.meta}</p>
                </div>
                <span className="text-[13px] font-semibold text-accent">보기</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RouteMock() {
  return (
    <div>
      <svg viewBox="0 0 320 220" className="w-full rounded-card bg-[#eef3ea]">
        <path d="M0 60 H320 M0 150 H320 M90 0 V220 M230 0 V220" stroke="#fff" strokeWidth="14" />
        <path d="M40 190 L90 150 L90 60 L230 60 L270 30" fill="none" stroke="#d4d4d8" strokeWidth="5" strokeDasharray="2 8" strokeLinecap="round" />
        <path d="M40 190 L90 190 L230 190 L230 60 L270 30" fill="none" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        {[
          [90, 105],
          [160, 60],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="13" fill="#dc2626" />
            <text x={x} y={y + 5} fontSize="15" fontWeight="700" textAnchor="middle" fill="#fff">!</text>
          </g>
        ))}
        {[
          [160, 190],
          [230, 120],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 12} y={y - 12} width="24" height="24" rx="6" fill="#eab308" />
            <text x={x} y={y + 5} fontSize="13" fontWeight="700" textAnchor="middle" fill="#fff">★</text>
          </g>
        ))}
        <circle cx="40" cy="190" r="9" fill="#111" />
        <text x="40" y="214" fontSize="12" textAnchor="middle" fill="#111">학교</text>
        <circle cx="270" cy="30" r="9" fill="#3182f6" />
        <text x="270" y="16" fontSize="12" textAnchor="middle" fill="#111">학원</text>
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <span><b className="text-danger">!</b> 부모들이 찍은 위험지점</span>
        <span><b className="text-[#eab308]">★</b> 아동안전지킴이집</span>
        <span><b className="text-[#16a34a]">━</b> 추천 길 (2분 더 걸림)</span>
      </div>
    </div>
  );
}

function AlertMock() {
  return (
    <div className="space-y-3">
      <div className="rounded-card bg-surface-2 p-3">
        <p className="text-[13px] font-semibold text-ink-3">평소 — 13:00~13:20</p>
        <p className="mt-1 text-[15px]">알림 없음 = 잘 도착했다는 뜻</p>
      </div>
      <div className="rounded-card bg-card p-3 shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-6 w-6 rounded-md border border-line" />
          <span className="text-[13px] font-semibold">사이</span>
          <span className="ml-auto text-[12px] text-ink-3">13:32</span>
        </div>
        <p className="mt-1.5 text-[15px] font-semibold">아이가 13:30까지 학원에 도착하지 않았어요</p>
        <p className="text-[14px] text-ink-2">마지막 확인: 편의점 앞 (지킴이집) · 학원에 전화하기</p>
      </div>
      <p className="text-[13px] text-ink-3">아이는 아무것도 안 해도 돼요. 이상할 때만 한 번 알려요.</p>
    </div>
  );
}

function NeighborMock() {
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold text-ink-3">우리 동네 품앗이 (예시)</p>
      {[
        { who: "3단지 ○○네", give: "화 15~17시 봐줄 수 있어요", need: "목 저녁이 비어요" },
        { who: "초록마을 △△네", give: "목 17~19시 봐줄 수 있어요", need: "화 오후가 비어요" },
      ].map((n) => (
        <div key={n.who} className="rounded-card bg-surface-2 p-3">
          <p className="text-[15px] font-semibold">{n.who}</p>
          <p className="mt-1 text-[14px] text-accent">＋ {n.give}</p>
          <p className="text-[14px] text-danger">－ {n.need}</p>
        </div>
      ))}
      <div className="rounded-card bg-accent-soft p-3 text-[14px] font-semibold text-accent">
        두 집의 빈 시간이 서로 맞아요 · 인사 나누기
      </div>
    </div>
  );
}
