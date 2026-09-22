"use client";

import { useEffect, useRef, useState } from "react";
import { REGIONS } from "@/lib/constants";
import { useStore } from "@/lib/store";
import type { Interview } from "@/lib/types";
import { Board } from "./Board";
import { DataPanel } from "./DataPanel";
import { InterviewEditor } from "./InterviewEditor";
import { InterviewList } from "./InterviewList";
import { MapView } from "./MapView";
import { Segmented } from "./ui";


type Tab = "interview" | "map" | "board" | "data";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "interview",
    label: "인터뷰",
    icon: <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />,
  },
  { id: "map", label: "위험지도", icon: <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /> },
  { id: "board", label: "보드", icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { id: "data", label: "데이터", icon: <path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /> },
];

const TITLES: Record<Tab, string> = {
  interview: "인터뷰",
  map: "통학 위험지도",
  board: "리서치 보드",
  data: "데이터",
};

export function AppShell() {
  const { region, setRegion } = useStore();
  const [tab, setTab] = useState<Tab>("interview");
  const [editing, setEditing] = useState<Interview | null>(null);

  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-[430px] flex-col bg-bg">
      <header className="pt-safe shrink-0 px-4 pb-2">
        {/* 피그마 헤더: 로고만 보이고 페이지 제목은 화면 읽기용으로만 둔다 */}
        <div className="px-5 pt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="사이" className="h-[28px] w-auto" />
          <h1 className="sr-only">{TITLES[tab]}</h1>
        </div>
        {tab !== "data" && tab !== "board" && (
          <div className="mt-5">
            <Segmented value={region} options={REGIONS} onChange={setRegion} size="sm" />
          </div>
        )}
      </header>

      <main className={`min-h-0 flex-1 ${tab === "map" ? "" : "overflow-y-auto"}`}>
        {tab === "interview" && <InterviewList onOpen={setEditing} />}
        {tab === "map" && <MapView />}
        {tab === "board" && <Board />}
        {tab === "data" && <DataPanel />}
      </main>

      {/* 위험지도에서는 지도가 메뉴바 뒤까지 이어지도록 메뉴바를 지도 위에 띄운다 */}
      <TabBar tab={tab} onChange={setTab} overlay={tab === "map"} />

      {editing && <InterviewEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/*
 * 피그마 하단 메뉴바: 떠 있는 흰 바 + 선택된 탭이 흰 동그라미로 올라오고 그 자리가 오목하게 파인다.
 * 파인 모양은 바 폭에 따라 달라서 폭을 재서 SVG 경로를 그린다. (피그마 경로 수치 그대로)
 */
const BAR_PAD = 20; // 바 안쪽 좌우 여백
const NOTCH = 35; // 오목한 곳 반폭
const BAR_H = 62; // 흰 바 높이
const TOP = 34; // 동그라미가 올라오는 여유

function surfacePath(w: number, cx: number): string {
  const l = cx - NOTCH;
  const r = cx + NOTCH;
  return [
    `M 24 0 L ${l} 0`,
    `C ${l + 6} 0 ${l + 5} 32 ${cx} 32`,
    `C ${r - 5} 32 ${r - 6} 0 ${r} 0`,
    `L ${w - 24} 0 C ${w - 8} 0 ${w} 8 ${w} 24 L ${w} ${BAR_H} L 0 ${BAR_H} L 0 24 C 0 8 8 0 24 0 Z`,
  ].join(" ");
}

/** 테두리 선: 바닥 쪽은 화면 끝까지 이어지므로 위쪽과 양옆만 그린다 */
function outlinePath(w: number, cx: number): string {
  const l = cx - NOTCH;
  const r = cx + NOTCH;
  return [
    `M 0 ${BAR_H + 1} L 0 24 C 0 8 8 0 24 0 L ${l} 0`,
    `C ${l + 6} 0 ${l + 5} 32 ${cx} 32`,
    `C ${r - 5} 32 ${r - 6} 0 ${r} 0`,
    `L ${w - 24} 0 C ${w - 8} 0 ${w} 8 ${w} 24 L ${w} ${BAR_H + 1}`,
  ].join(" ");
}

function TabBar({ tab, onChange, overlay }: { tab: Tab; onChange: (t: Tab) => void; overlay: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(361);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const i = TABS.findIndex((t) => t.id === tab);
  const pos = useSlide(i);
  const slot = (w - BAR_PAD * 2) / TABS.length;
  const cx = BAR_PAD + slot * (pos + 0.5);

  return (
    <nav className={`z-10 shrink-0 ${overlay ? "absolute inset-x-0 bottom-0" : "relative"}`}>
      <div ref={ref} className="relative">
        {/* 흰 바: 오목한 윗부분(SVG) + 화면 아래 끝까지 이어지는 흰 부분. 그림자는 둘을 합쳐서 한 번만 */}
        <div className="pointer-events-none absolute inset-0 drop-shadow-[0_-2px_10px_rgba(26,41,61,0.08)]" aria-hidden>
          <svg className="absolute left-0" style={{ top: TOP }} width={w} height={BAR_H + 1} viewBox={`0 0 ${w} ${BAR_H + 1}`}>
            <path d={surfacePath(w, cx) + ` M 0 ${BAR_H} L 0 ${BAR_H + 1} L ${w} ${BAR_H + 1} L ${w} ${BAR_H} Z`} fill="var(--card)" />
            <path d={outlinePath(w, cx)} fill="none" stroke="var(--line)" strokeWidth="1" />
          </svg>
          <div
            className="absolute inset-x-0 bottom-0 bg-card"
            style={{ top: TOP + BAR_H }}
          />
        </div>
        <div className="relative" style={{ height: TOP + BAR_H }}>
          <span
            className="absolute top-[2px] h-[62px] w-[62px] rounded-full border border-line bg-card shadow-[0_5px_12px_-2px_rgba(26,41,61,0.16)]"
            style={{ left: cx - 31 }}
            aria-hidden
          />
          {TABS.map((t, k) => {
            const on = k === i;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={on ? "page" : undefined}
                className={`absolute top-0 h-full transition-colors duration-300 ${on ? "text-accent" : "text-ink-3"}`}
                style={{ left: BAR_PAD + slot * k, width: slot }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="absolute left-1/2 h-6 w-6 -translate-x-1/2 transition-[top] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
                  style={{ top: on ? 22 : 48 }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {t.icon}
                </svg>
                <span
                  className={`absolute left-0 right-0 text-center transition-[top] duration-300 ${on ? "text-[13px] font-bold" : "text-[12px] font-medium"}`}
                  style={{ top: on ? 71 : 75 }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
        {/* 메뉴바 아래 여백 — 흰 바가 화면 끝까지 이어진다 */}
        <div style={{ height: "calc(var(--safe-bottom) + 20px)" }} />
      </div>
    </nav>
  );
}

/**
 * 선택된 탭 위치(0~3)를 부드럽게 따라가는 값. 동그라미와 오목한 자리가 같은 값을 써서 함께 미끄러진다.
 * SVG 경로는 CSS로 애니메이션이 안 되는 브라우저(사파리)가 있어서 직접 프레임마다 계산한다.
 */
function useSlide(target: number, ms = 380): number {
  const [pos, setPos] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    // 움직임 줄이기 설정이면 한 프레임에 바로 이동
    const dur = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : ms;
    const t0 = performance.now();
    let raf = 0;
    // 살짝 지나쳤다가 제자리로 (easeOutBack)
    const ease = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const v = start + (target - start) * ease(t);
      from.current = v;
      setPos(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return pos;
}
