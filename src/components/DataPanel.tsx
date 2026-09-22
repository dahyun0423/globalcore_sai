"use client";

import { useRef, useState } from "react";
import { formatDuration, timeAgo } from "@/lib/format";
import { setTeamCode, syncNow, useSync } from "@/lib/share";
import {
  CONCEPTS,
  CORE_QUESTIONS,
  PIN_SOURCE_META,
  REGION_LABEL,
  RESPONDENT_LABEL,
} from "@/lib/constants";
import { useStore } from "@/lib/store";
import { gapMinutes } from "@/lib/stats";
import type { FieldData } from "@/lib/types";
import { timelineSummary } from "./Timeline";
import { Button, Card, SectionTitle } from "./ui";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  // 엑셀에서 한글 안 깨지게 BOM
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

export function DataPanel() {
  const { data, merge, clearAll, saveError } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const exportJSON = () => download(`sai-${stamp()}.json`, JSON.stringify(data, null, 2), "application/json");

  const exportInterviews = () => {
    const header = [
      "id", "날짜", "지역", "응답자", "장소", "학년대", "공백(분)", "타임라인",
      "학원=돌봄목적", "이웃신뢰", "월비용",
      ...CORE_QUESTIONS.map((_, i) => `Q${i + 1}`), "기타",
      ...CONCEPTS.map((c) => `반응:${c.title}`),
      "메모", "요약:공백", "요약:남는문제", "요약:인용",
    ];
    const rows = data.interviews.map((i) => [
      i.id, i.createdAt.slice(0, 16), REGION_LABEL[i.region], RESPONDENT_LABEL[i.respondent], i.place, i.gradeBand,
      gapMinutes(i.slots), timelineSummary(i.slots),
      i.privateForCare, i.neighborTrust, i.monthlyCost,
      ...i.answers,
      ...CONCEPTS.map((c) => [i.feedback?.[c.id]?.reaction, i.feedback?.[c.id]?.comment].filter(Boolean).join(" / ")),
      i.notes,
      i.analysis?.gapTimes.join(" | "), i.analysis?.remainingProblems.join(" | "), i.analysis?.quotes.join(" | "),
    ]);
    download(`interviews-${stamp()}.csv`, csv([header, ...rows]), "text/csv");
  };

  const exportPins = () => {
    const rows = data.pins.map((p) => [
      p.id, p.createdAt.slice(0, 16), REGION_LABEL[p.region], PIN_SOURCE_META[p.source].label,
      p.lat.toFixed(6), p.lng.toFixed(6), p.tags.join("|"), p.memo, p.photos?.length ?? 0,
    ]);
    download(`pins-${stamp()}.csv`, csv([["id", "날짜", "지역", "출처", "위도", "경도", "태그", "메모", "사진수"], ...rows]), "text/csv");
  };

  const exportRoutes = () => {
    const rows = data.routes.map((r) => [
      r.id, r.createdAt.slice(0, 16), REGION_LABEL[r.region], r.kind === "walked" ? "걸은 경로" : "그린 경로",
      r.name, r.distanceM, r.durationSec != null ? formatDuration(r.durationSec) : "", r.memo,
      r.points.map(([a, b]) => `${a.toFixed(6)} ${b.toFixed(6)}`).join(";"),
    ]);
    download(
      `routes-${stamp()}.csv`,
      csv([["id", "날짜", "지역", "종류", "이름", "거리(m)", "걸린시간", "메모", "좌표(위도 경도;...)"], ...rows]),
      "text/csv",
    );
  };

  const importJSON = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as FieldData;
      const r = merge(parsed);
      setMsg(`인터뷰 ${r.interviews}건, 위험지점 ${r.pins}곳, 경로 ${r.routes}개를 합쳤어요.`);
    } catch {
      setMsg("파일을 읽지 못했어요. 사이에서 내보낸 JSON인지 확인해 주세요.");
    }
  };

  return (
    <div className="px-4 pb-8">
      {saveError && (
        <p className="mt-3 rounded-field bg-danger-soft p-3 text-[13px] text-danger">
          이 브라우저에 저장이 안 되고 있어요 (개인정보 보호 모드?). 지금 바로 JSON으로 내보내 두세요.
        </p>
      )}
      <SectionTitle>이 폰에 저장된 것</SectionTitle>
      <Card className="flex justify-around text-center">
        <div>
          <p className="text-[28px] font-bold tabular-nums">{data.interviews.length}</p>
          <p className="text-[13px] text-ink-3">인터뷰</p>
        </div>
        <div>
          <p className="text-[28px] font-bold tabular-nums">{data.pins.length}</p>
          <p className="text-[13px] text-ink-3">위험지점</p>
        </div>
        <div>
          <p className="text-[28px] font-bold tabular-nums">{data.routes.length}</p>
          <p className="text-[13px] text-ink-3">경로</p>
        </div>
      </Card>

      <TeamShare />

      <SectionTitle>내보내기</SectionTitle>
      <div className="space-y-2">
        <Button className="w-full" onClick={exportJSON}>
          전체 백업 (JSON)
        </Button>
        <Button variant="secondary" className="w-full" onClick={exportInterviews}>
          인터뷰 표 (CSV · 엑셀용)
        </Button>
        <Button variant="secondary" className="w-full" onClick={exportPins}>
          위험지점 표 (CSV)
        </Button>
        <Button variant="secondary" className="w-full" onClick={exportRoutes}>
          경로 표 (CSV)
        </Button>
      </div>
      <p className="mt-2 px-1 text-[12px] text-ink-3">
        매일 밤 정리 시간에 JSON 백업을 한 번씩 받아 두세요. 녹음 파일은 인터뷰마다 &lsquo;정리&rsquo; 단계에서 따로
        저장해요.
      </p>

      <SectionTitle>다른 폰 데이터 합치기</SectionTitle>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importJSON(f);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
        JSON 불러와서 합치기
      </Button>
      {msg && <p className="mt-2 px-1 text-[13px] text-ink-2">{msg}</p>}

      <SectionTitle>초기화</SectionTitle>
      {confirm ? (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
            취소
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              clearAll();
              setConfirm(false);
              setMsg("모두 지웠어요.");
            }}
          >
            정말 모두 지우기
          </Button>
        </div>
      ) : (
        <Button variant="danger" className="w-full" onClick={() => setConfirm(true)}>
          이 폰의 인터뷰·위험지점·경로 모두 지우기
        </Button>
      )}
    </div>
  );
}

/** 팀 코드를 넣으면 위험지점(사진 포함)·경로가 팀원 폰끼리 공유된다. 인터뷰는 공유하지 않는다 */
function TeamShare() {
  const sync = useSync();
  const [draft, setDraft] = useState(sync.code);
  const changed = draft.trim() !== sync.code;

  return (
    <>
      <SectionTitle>팀 공유</SectionTitle>
      <Card>
        <p className="text-[14px] text-ink-2">
          팀 코드를 넣으면 <b>위험지점·사진·경로</b>가 팀원 폰과 공유돼요. 인터뷰 내용은 공유하지 않고 이 폰에만 있어요.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="팀 코드"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-chip border border-line bg-card px-3.5 py-3 text-[16px] outline-none focus:border-accent"
          />
          <Button
            variant={changed ? "accent" : "secondary"}
            onClick={() => {
              if (changed) setTeamCode(draft);
              void syncNow();
            }}
          >
            {changed ? "저장" : "지금 동기화"}
          </Button>
        </div>
        <p className={`mt-2 text-[13px] ${sync.error ? "text-danger" : "text-ink-3"}`}>
          {!sync.code
            ? "아직 팀 코드가 없어요. 기록은 이 폰에만 저장돼요."
            : sync.busy
              ? "동기화 중…"
              : sync.error
                ? sync.error
                : sync.lastSync
                  ? `마지막 동기화 ${timeAgo(sync.lastSync)}`
                  : "코드 저장됨 · 지도를 열면 자동으로 동기화돼요"}
        </p>
      </Card>
    </>
  );
}
