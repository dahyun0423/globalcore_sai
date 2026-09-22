"use client";

import { useRef, useState } from "react";
import { SLOT_COUNT, SLOT_META, SLOT_TYPES, slotLabel, timeToSlot } from "@/lib/constants";
import { gapMinutes, moveCount } from "@/lib/stats";
import type { SlotType } from "@/lib/types";
import { Button, inputClass } from "./ui";

type Brush = SlotType | "erase";

/**
 * 30분 칸을 손가락으로 쓸어서 칠하는 하루 타임라인.
 * 세로 방향이라 아이폰 한 화면에 12:00~21:00이 다 들어간다.
 */
export function Timeline({
  slots,
  onChange,
}: {
  slots: (SlotType | null)[];
  onChange: (slots: (SlotType | null)[]) => void;
}) {
  const [brush, setBrush] = useState<Brush>("alone");
  const [quickOpen, setQuickOpen] = useState(false);
  const painting = useRef(false);
  const working = useRef(slots);

  const paintAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const idx = el?.closest<HTMLElement>("[data-slot]")?.dataset.slot;
    if (idx === undefined) return;
    const i = Number(idx);
    const value = brush === "erase" ? null : brush;
    if (working.current[i] === value) return;
    working.current = working.current.map((s, k) => (k === i ? value : s));
    onChange(working.current);
  };

  const gap = gapMinutes(slots);
  const moves = moveCount(slots);

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="grid grid-cols-3 gap-1.5">
          {SLOT_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setBrush(t.type)}
              className={`flex items-center gap-1.5 rounded-chip border px-2 py-2 text-left text-[13px] font-semibold ${
                brush === t.type ? "border-ink bg-card" : "border-transparent bg-card/60"
              }`}
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded-[4px]" style={{ background: t.color }} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <button
            type="button"
            onClick={() => setBrush("erase")}
            className={`flex-1 rounded-chip border py-1.5 text-[13px] font-semibold ${
              brush === "erase" ? "border-ink bg-card" : "border-transparent bg-card/60 text-ink-2"
            }`}
          >
            지우개
          </button>
          <button
            type="button"
            onClick={() => setQuickOpen((v) => !v)}
            className="flex-1 rounded-chip bg-card/60 py-1.5 text-[13px] font-semibold text-ink-2"
          >
            {quickOpen ? "닫기" : "3분 빠른 입력"}
          </button>
        </div>
        {quickOpen && (
          <QuickFill
            onApply={(next) => {
              working.current = next;
              onChange(next);
              setQuickOpen(false);
            }}
            slots={slots}
          />
        )}
        <div className="mt-2 flex items-baseline justify-between rounded-field bg-card px-3 py-2">
          <span className="text-[14px] text-ink-2">어른 없는 시간</span>
          <span className="text-[22px] font-bold tabular-nums" style={{ color: gap ? "var(--danger)" : "var(--ink-3)" }}>
            {gap}분
            <span className="ml-2 text-[13px] font-medium text-ink-3">이동 {moves}회</span>
          </span>
        </div>
      </div>

      <div
        className="mt-1 select-none rounded-card bg-card p-2"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          painting.current = true;
          working.current = slots;
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
          paintAt(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => painting.current && paintAt(e.clientX, e.clientY)}
        onPointerUp={() => (painting.current = false)}
        onPointerCancel={() => (painting.current = false)}
        onPointerLeave={() => (painting.current = false)}
      >
        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const s = slots[i];
          const meta = s ? SLOT_META[s] : null;
          const onHour = i % 2 === 0;
          return (
            <div key={i} data-slot={i} className="flex h-[34px] items-stretch">
              <span className={`w-12 shrink-0 pr-2 text-right text-[12px] tabular-nums ${onHour ? "text-ink-2" : "text-ink-3/70"}`}>
                {onHour ? slotLabel(i) : ""}
              </span>
              <div
                className={`flex flex-1 items-center rounded-[6px] px-3 text-[13px] font-semibold ${
                  onHour ? "border-t border-line" : ""
                }`}
                style={{
                  background: meta ? meta.color : "var(--surface-2)",
                  color: meta ? "#fff" : "transparent",
                  marginTop: 1,
                }}
              >
                {meta && s !== slots[i - 1] ? meta.label : ""}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[12px] text-ink-3">
        색을 고르고 칸을 위아래로 쓸어서 칠하세요. 빨강·주황(혼자, 혼자 이동)이 공백으로 계산됩니다.
      </p>
    </div>
  );
}

function QuickFill({
  slots,
  onApply,
}: {
  slots: (SlotType | null)[];
  onApply: (slots: (SlotType | null)[]) => void;
}) {
  const [t, setT] = useState({ out: "13:00", adult: "13:30", home: "18:00", parent: "19:00" });
  const fields: { key: keyof typeof t; label: string }[] = [
    { key: "out", label: "하교" },
    { key: "adult", label: "첫 어른 만남" },
    { key: "home", label: "아이 귀가" },
    { key: "parent", label: "보호자 귀가" },
  ];
  const apply = () => {
    const [a, b, c, d] = [t.out, t.adult, t.home, t.parent].map(timeToSlot);
    if ([a, b, c, d].some((x) => x === null)) return;
    const next = [...slots];
    for (let i = a!; i < b!; i++) next[i] = "move";
    for (let i = c!; i < d!; i++) next[i] = "alone";
    onApply(next);
  };
  return (
    <div className="mt-2 rounded-field bg-card p-3">
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <label key={f.key} className="text-[12px] font-medium text-ink-2">
            {f.label}
            <input
              type="time"
              step={1800}
              value={t[f.key]}
              onChange={(e) => setT({ ...t, [f.key]: e.target.value })}
              className={`${inputClass} mt-1 py-1.5`}
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-ink-3">
        하교~첫 어른 = 혼자 이동, 아이 귀가~보호자 귀가 = 혼자로 칠합니다. 사이 시간은 직접 칠하세요.
      </p>
      <Button onClick={apply} className="mt-2 w-full" variant="primary">
        적용
      </Button>
    </div>
  );
}

export function timelineSummary(slots: (SlotType | null)[]): string {
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i <= slots.length; i++) {
    if (i === slots.length || slots[i] !== slots[start]) {
      const s = slots[start];
      if (s) parts.push(`${slotLabel(start)}~${slotLabel(i)} ${SLOT_META[s].label}`);
      start = i;
    }
  }
  return parts.join(", ");
}
