"use client";

import { useSyncExternalStore } from "react";
import { loadPhoto, savePhoto } from "./photo-db";
import { currentData, storeActions } from "./store";
import type { Pin, Route } from "./types";

/*
 * 팀 공유: 폰에 먼저 저장하고, 동기화할 때
 *   ① 지운 것 반영 → ② 안 올린 사진·기록 올리기 → ③ 팀 전체 기록 받아 합치기
 * 순서로 맞춘다. 현장에서 인터넷이 끊겨도 기록은 폰에 남고, 다음 동기화 때 올라간다.
 */

const CODE_KEY = "fieldkit:team";
const DELETES_KEY = "fieldkit:v1:deletes";

type Kind = "pins" | "routes";
interface PendingDelete {
  kind: Kind;
  id: string;
}

export interface SyncState {
  code: string;
  busy: boolean;
  error: string | null;
  lastSync: string | null;
}

function readCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

let state: SyncState | null = null;
const listeners = new Set<() => void>();
const getState = (): SyncState => (state ??= { code: readCode(), busy: false, error: null, lastSync: null });
function setState(patch: Partial<SyncState>) {
  state = { ...getState(), ...patch };
  listeners.forEach((l) => l());
}

export function useSync() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getState,
    getState,
  );
}

export function setTeamCode(code: string) {
  const c = code.trim();
  try {
    if (c) localStorage.setItem(CODE_KEY, c);
    else localStorage.removeItem(CODE_KEY);
  } catch {}
  setState({ code: c, error: null });
}

function readDeletes(): PendingDelete[] {
  try {
    return JSON.parse(localStorage.getItem(DELETES_KEY) ?? "[]") as PendingDelete[];
  } catch {
    return [];
  }
}
function writeDeletes(list: PendingDelete[]) {
  try {
    localStorage.setItem(DELETES_KEY, JSON.stringify(list));
  } catch {}
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), "x-team-code": getState().code },
  });
  if (!res.ok) {
    const msg = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
    throw new Error(msg ?? `서버 오류 (${res.status})`);
  }
  return res;
}

/**
 * 저장소에서도 지우도록 예약한다. 아직 안 올라간 것 같아도 예약한다 —
 * 마침 올리는 중이었을 수 있어서. 없는 파일을 지우는 건 아무 일도 안 일어난다.
 */
export function queueRemoteDelete(kind: Kind, item: Pin | Route) {
  writeDeletes([...readDeletes(), { kind, id: item.id }]);
  void syncNow();
}

/** synced는 이 폰의 상태라 저장소에는 올리지 않는다 */
function withoutSyncFlag<T extends Pin | Route>(x: T): Omit<T, "synced"> {
  const copy = { ...x };
  delete copy.synced;
  return copy;
}

async function pushPin(pin: Pin) {
  for (const id of pin.photos ?? []) {
    const blob = await loadPhoto(id);
    if (!blob) continue; // 다른 폰에서 받아온 사진 — 이미 저장소에 있음
    const form = new FormData();
    form.set("id", id);
    form.set("file", blob, `${id}.jpg`);
    await api("/api/photo", { method: "POST", body: form });
  }
  await api("/api/share", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "pins", item: withoutSyncFlag(pin) }),
  });
}

async function pushRoute(route: Route) {
  await api("/api/share", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "routes", item: withoutSyncFlag(route) }),
  });
}

let running: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  if (!getState().code) return Promise.resolve();
  // 이미 도는 중이면 끝난 뒤 한 번 더 (그 사이 생긴 기록까지 올리려고)
  if (running) return running.then(() => syncNow());
  running = (async () => {
    setState({ busy: true, error: null });
    try {
      let deletes = readDeletes();
      for (const d of deletes) {
        await api(`/api/share?kind=${d.kind}&id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
        deletes = deletes.filter((x) => x !== d);
        writeDeletes(deletes);
      }

      const data = currentData();
      const pins = data.pins.filter((p) => !p.synced);
      for (const p of pins) await pushPin(p);
      storeActions.markSynced("pins", pins);
      const routes = data.routes.filter((r) => !r.synced);
      for (const r of routes) await pushRoute(r);
      storeActions.markSynced("routes", routes);

      const remote = (await (await api("/api/share")).json()) as { pins: Pin[]; routes: Route[] };
      storeActions.applyRemote(remote, new Set(readDeletes().map((d) => d.id)));
      setState({ lastSync: new Date().toISOString() });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "동기화하지 못했어요." });
    } finally {
      setState({ busy: false });
      running = null;
    }
  })();
  return running;
}

/** 사진 보기: 폰에 있으면 그걸, 없으면 팀 저장소에서 받아 폰에 남겨 둔다 */
export async function photoBlob(id: string): Promise<Blob | null> {
  const local = await loadPhoto(id);
  if (local) return local;
  if (!getState().code) return null;
  try {
    const blob = await (await api(`/api/photo?id=${encodeURIComponent(id)}`)).blob();
    await savePhoto(id, blob);
    return blob;
  } catch {
    return null;
  }
}
