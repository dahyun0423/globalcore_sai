"use client";

import { useSyncExternalStore } from "react";
import { distance, pathLength } from "./maps/types";

/*
 * 걸으며 경로 기록. 지도 화면 밖(다른 탭)으로 가도 끊기지 않게 컴포넌트가 아니라 모듈에 둔다.
 * 브라우저는 화면이 꺼지면 위치를 멈추므로, 걷는 동안 화면 켜짐(Wake Lock)을 요청한다.
 */

/** 이보다 부정확한 위치는 버린다 (실내·건물 사이에서 튀는 값) */
const MAX_ACCURACY_M = 35;
/** 이만큼은 움직여야 점을 하나 더 찍는다 */
const MIN_STEP_M = 6;

export interface WalkState {
  active: boolean;
  startedAt: number | null;
  points: [number, number][];
  accuracy: number | null;
  error: string | null;
}

const IDLE: WalkState = { active: false, startedAt: null, points: [], accuracy: null, error: null };
let state: WalkState = IDLE;
let watchId: number | null = null;
let wakeLock: { release(): Promise<void> } | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<WalkState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useWalk(): WalkState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => IDLE,
  );
}

async function keepAwake() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
    wakeLock = (await nav.wakeLock?.request("screen")) ?? null;
  } catch {
    wakeLock = null;
  }
}

// 다른 앱에 갔다 오면 화면 켜짐 요청이 풀리므로 다시 건다
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (state.active && document.visibilityState === "visible") void keepAwake();
  });

export function startWalk() {
  if (state.active) return;
  if (!navigator.geolocation) {
    set({ error: "이 브라우저는 위치를 지원하지 않아요." });
    return;
  }
  set({ ...IDLE, active: true, startedAt: Date.now() });
  void keepAwake();
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const p: [number, number] = [latitude, longitude];
      if (accuracy > MAX_ACCURACY_M) return set({ accuracy, error: null });
      const last = state.points[state.points.length - 1];
      if (last && distance(last, p) < MIN_STEP_M) return set({ accuracy, error: null });
      set({ points: [...state.points, p], accuracy, error: null });
    },
    (err) =>
      set({
        error: err.code === err.PERMISSION_DENIED ? "위치 권한을 허용해 주세요." : "위치를 잡지 못하고 있어요. 하늘이 보이는 곳으로 가 보세요.",
      }),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
  );
}

/** 끝내고 기록을 돌려준다. 점이 2개 미만이면 null */
export function stopWalk(): { points: [number, number][]; durationSec: number; distanceM: number } | null {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  void wakeLock?.release().catch(() => {});
  wakeLock = null;
  const { points, startedAt } = state;
  set(IDLE);
  if (points.length < 2 || !startedAt) return null;
  return { points, durationSec: Math.round((Date.now() - startedAt) / 1000), distanceM: Math.round(pathLength(points)) };
}
