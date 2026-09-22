"use client";

import { useEffect, useState } from "react";
import { formatDistance, formatDuration, formatWhen } from "@/lib/format";
import { pathLength } from "@/lib/maps";
import type { Route } from "@/lib/types";
import type { WalkState } from "@/lib/walk";
import { Button, Sheet, inputClass } from "../ui";

export const ROUTE_COLOR = { drawn: "#3182f6", walked: "#16a34a" } as const;
const KIND_LABEL = { drawn: "그린 경로", walked: "걸은 경로" } as const;

/** 지도를 눌러 점을 이어 그리는 중 */
export function DrawBar({
  count,
  distanceM,
  onUndo,
  onCancel,
  onDone,
}: {
  count: number;
  distanceM: number;
  onUndo: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <Sheet>
      <p className="text-[17px] font-bold">경로 그리기</p>
      <p className="mt-0.5 text-[13px] text-ink-2">
        {count === 0 ? "출발점(예: 학교 교문)을 지도에서 눌러요." : `길을 따라 눌러서 이어 가요 · ${formatDistance(distanceM)}`}
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          취소
        </Button>
        <Button variant="secondary" className="flex-1" disabled={!count} onClick={onUndo}>
          되돌리기
        </Button>
        <Button variant="accent" className="flex-1" disabled={count < 2} onClick={onDone}>
          완료
        </Button>
      </div>
    </Sheet>
  );
}

/** 걸으며 기록하는 중 */
export function WalkBar({ walk, onRecordHere, onStop }: { walk: WalkState; onRecordHere: () => void; onStop: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = walk.startedAt ? Math.max(0, Math.round((now - walk.startedAt) / 1000)) : 0;
  const meters = pathLength(walk.points);

  return (
    <div className="absolute inset-x-3 z-[550] rounded-card bg-card p-3 shadow-float" style={{ bottom: "calc(var(--tabbar-h) + 8px)" }}>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
        <span className="text-[15px] font-bold tabular-nums">
          걷는 중 · {formatDuration(sec)} · {formatDistance(meters)}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] text-ink-3">
        {walk.error ??
          (walk.accuracy ? `위치 정확도 약 ${Math.round(walk.accuracy)}m · 화면을 켜 둔 채로 걸어 주세요` : "위치 잡는 중…")}
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onRecordHere}>
          여기 위험해요
        </Button>
        <Button variant="danger" className="flex-1" onClick={onStop}>
          끝내기
        </Button>
      </div>
    </div>
  );
}

/** 다 그렸거나 다 걸은 뒤 이름 붙여 저장 */
export function RouteSaveForm({
  kind,
  distanceM,
  durationSec,
  onSave,
  onCancel,
}: {
  kind: Route["kind"];
  distanceM: number;
  durationSec?: number;
  onSave: (name: string, memo: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(() => `하굣길 ${formatWhen(new Date().toISOString())}`);
  const [memo, setMemo] = useState("");
  return (
    <Sheet>
      <p className="text-[17px] font-bold">{KIND_LABEL[kind]} 저장</p>
      <p className="mt-0.5 text-[13px] text-ink-2">
        {formatDistance(distanceM)}
        {durationSec != null && ` · ${formatDuration(durationSec)}`}
      </p>
      <input className={`${inputClass} mt-3`} value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 (예: 학교→센터)" />
      <input
        className={`${inputClass} mt-2`}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="메모 (예: 어른 없이 혼자 가는 구간)"
      />
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          버리기
        </Button>
        <Button variant="accent" className="flex-[2]" disabled={!name.trim()} onClick={() => onSave(name.trim(), memo.trim())}>
          저장
        </Button>
      </div>
    </Sheet>
  );
}

/** 이 지역 경로 목록 */
export function RouteList({
  routes,
  onFocus,
  onDelete,
  onClose,
}: {
  routes: Route[];
  onFocus: (r: Route) => void;
  onDelete: (r: Route) => void;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <Sheet>
      <div className="flex items-center">
        <p className="text-[17px] font-bold">통학 경로 {routes.length}개</p>
        <button type="button" onClick={onClose} className="ml-auto px-2 text-[14px] font-semibold text-ink-3">
          닫기
        </button>
      </div>
      {routes.length === 0 && <p className="mt-2 text-[14px] text-ink-3">아직 없어요. 아래 &lsquo;경로 그리기&rsquo;나 &lsquo;걸으며 기록&rsquo;으로 만들어요.</p>}
      <div className="mt-2 divide-y divide-line">
        {routes.map((r) => (
          <div key={r.id} className="flex items-center gap-2 py-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: ROUTE_COLOR[r.kind] }} />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onFocus(r)}>
              <span className="block truncate text-[15px] font-semibold">{r.name}</span>
              <span className="block text-[12px] text-ink-3">
                {KIND_LABEL[r.kind]} · {formatDistance(r.distanceM)}
                {r.durationSec != null && ` · ${formatDuration(r.durationSec)}`} · {r.synced ? "팀 공유됨" : "이 폰에만"}
              </span>
              {r.memo && <span className="block truncate text-[13px] text-ink-2">{r.memo}</span>}
            </button>
            <button
              type="button"
              onClick={() => (confirm === r.id ? onDelete(r) : setConfirm(r.id))}
              className="shrink-0 rounded-chip border border-danger-line px-2.5 py-1.5 text-[13px] font-semibold text-danger"
            >
              {confirm === r.id ? "정말 삭제" : "삭제"}
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
