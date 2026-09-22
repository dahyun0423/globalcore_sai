"use client";

import { useSyncExternalStore } from "react";
import { CORE_QUESTIONS, SLOT_COUNT } from "./constants";
import type { FieldData, Interview, Pin, Region, Route } from "./types";

const KEY = "fieldkit:v1";
const EMPTY: FieldData = { version: 1, interviews: [], pins: [], routes: [] };

function loadData(): FieldData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as FieldData;
    return {
      version: 1,
      interviews: parsed.interviews ?? [],
      pins: parsed.pins ?? [],
      routes: parsed.routes ?? [],
    };
  } catch {
    return EMPTY;
  }
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function blankInterview(region: Region): Interview {
  const now = new Date().toISOString();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    region,
    place: "",
    respondent: "parent",
    gradeBand: "unknown",
    consent: { explained: false, anonymous: false, noChild: false, recording: false },
    slots: Array(SLOT_COUNT).fill(null),
    privateForCare: null,
    monthlyCost: "",
    neighborTrust: null,
    answers: Array(CORE_QUESTIONS.length + 1).fill(""),
    audioClips: 0,
    feedback: {},
    notes: "",
    analysis: null,
  };
}

interface Snapshot {
  data: FieldData;
  region: Region;
  saveError: boolean;
}

/*
 * 앱 전체가 폰 안에서만 도는 도구라 서버 렌더링 없이 localStorage를 바로 읽는다.
 * (AppShell은 ssr:false로 불러온다)
 */
let snap: Snapshot | null = null;
const listeners = new Set<() => void>();

function get(): Snapshot {
  if (!snap) {
    let region: Region = "jeju";
    try {
      region = (localStorage.getItem(KEY + ":region") as Region | null) ?? "jeju";
    } catch {}
    snap = { data: loadData(), region, saveError: false };
  }
  return snap;
}

function setData(fn: (d: FieldData) => FieldData) {
  const data = fn(get().data);
  let saveError = false;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    saveError = true;
  }
  snap = { ...get(), data, saveError };
  listeners.forEach((l) => l());
}

/** React 밖(동기화 모듈)에서 현재 데이터를 읽을 때 */
export const currentData = () => get().data;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const storeActions = {
  setRegion(r: Region) {
    try {
      localStorage.setItem(KEY + ":region", r);
    } catch {}
    snap = { ...get(), region: r };
    listeners.forEach((l) => l());
  },
  upsertInterview(i: Interview) {
    const next = { ...i, updatedAt: new Date().toISOString() };
    setData((d) => ({
      ...d,
      interviews: d.interviews.some((x) => x.id === i.id)
        ? d.interviews.map((x) => (x.id === i.id ? next : x))
        : [next, ...d.interviews],
    }));
  },
  deleteInterview(id: string) {
    setData((d) => ({ ...d, interviews: d.interviews.filter((x) => x.id !== id) }));
  },
  addPin(p: Pin) {
    const next = { ...p, updatedAt: new Date().toISOString(), synced: false };
    setData((d) => ({ ...d, pins: [next, ...d.pins] }));
  },
  updatePin(p: Pin) {
    const next = { ...p, updatedAt: new Date().toISOString(), synced: false };
    setData((d) => ({ ...d, pins: d.pins.map((x) => (x.id === p.id ? next : x)) }));
  },
  deletePin(id: string) {
    setData((d) => ({ ...d, pins: d.pins.filter((x) => x.id !== id) }));
  },
  addRoute(r: Route) {
    const next = { ...r, updatedAt: new Date().toISOString(), synced: false };
    setData((d) => ({ ...d, routes: [next, ...d.routes] }));
  },
  deleteRoute(id: string) {
    setData((d) => ({ ...d, routes: d.routes.filter((x) => x.id !== id) }));
  },
  /** 팀 저장소에 올라간 것 표시. 올리는 사이에 고쳐졌으면(updatedAt 다름) 표시하지 않는다 */
  markSynced(kind: "pins" | "routes", items: { id: string; updatedAt?: string }[]) {
    const done = new Map(items.map((i) => [i.id, i.updatedAt]));
    setData((d) => ({
      ...d,
      [kind]: (d[kind] as (Pin | Route)[]).map((x) =>
        done.has(x.id) && done.get(x.id) === x.updatedAt ? { ...x, synced: true } : x,
      ),
    }));
  },
  /**
   * 팀 저장소 내용을 받아 합친다.
   * - 올린 적 있는데 저장소에 없으면 팀원이 지운 것 → 여기서도 지운다
   * - 아직 안 올린 것은 그대로 둔다 (다음 동기화 때 올라감)
   * - 둘 다 있으면 더 최근에 고친 쪽을 쓴다
   */
  applyRemote(remote: { pins: Pin[]; routes: Route[] }, skip: Set<string>) {
    const mergeList = <T extends Pin | Route>(local: T[], incoming: T[]): T[] => {
      const byId = new Map(incoming.map((x) => [x.id, x]));
      const kept: T[] = [];
      for (const x of local) {
        const r = byId.get(x.id);
        byId.delete(x.id);
        if (!r) {
          if (!x.synced) kept.push(x);
          continue;
        }
        if (!x.synced || (x.updatedAt ?? "") >= (r.updatedAt ?? "")) kept.push(x);
        else kept.push({ ...r, synced: true });
      }
      const added = [...byId.values()].filter((r) => !skip.has(r.id)).map((r) => ({ ...r, synced: true }));
      return [...added, ...kept].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    };
    setData((d) => ({ ...d, pins: mergeList(d.pins, remote.pins), routes: mergeList(d.routes, remote.routes) }));
  },
  /** 다른 폰에서 내보낸 JSON을 id 기준으로 합친다 */
  merge(incoming: FieldData) {
    const d = get().data;
    const haveI = new Set(d.interviews.map((i) => i.id));
    const haveP = new Set(d.pins.map((p) => p.id));
    const haveR = new Set(d.routes.map((r) => r.id));
    const newI = (incoming.interviews ?? []).filter((i) => !haveI.has(i.id));
    const newP = (incoming.pins ?? []).filter((p) => !haveP.has(p.id));
    const newR = (incoming.routes ?? []).filter((r) => !haveR.has(r.id));
    setData((cur) => ({
      ...cur,
      interviews: [...newI, ...cur.interviews],
      pins: [...newP, ...cur.pins],
      routes: [...newR, ...cur.routes],
    }));
    return { interviews: newI.length, pins: newP.length, routes: newR.length };
  },
  clearAll() {
    setData(() => EMPTY);
  },
};

export function useStore() {
  const s = useSyncExternalStore(subscribe, get, get);
  return { ...s, ...storeActions };
}
