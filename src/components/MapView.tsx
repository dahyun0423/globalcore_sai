"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { PIN_SOURCES, PIN_SOURCE_META, REGIONS } from "@/lib/constants";
import { formatDistance, timeAgo } from "@/lib/format";
import {
  PROVIDER_LABEL,
  createMap,
  pathLength,
  preferredProvider,
  searchPlaces,
  type MapAdapter,
  type MapMarker,
  type MapRoute,
  type PlaceResult,
  type ProviderId,
} from "@/lib/maps";
import { deletePhotos, savePhoto } from "@/lib/photo-db";
import { queueRemoteDelete, syncNow, useSync } from "@/lib/share";
import { newId, useStore } from "@/lib/store";
import type { Pin, PinSource, Route } from "@/lib/types";
import { startWalk, stopWalk, useWalk } from "@/lib/walk";
import { PinDetail } from "./map/PinDetail";
import { PinForm, type PinDraft } from "./map/PinForm";
import { PlaceSearch } from "./map/PlaceSearch";
import { DrawBar, ROUTE_COLOR, RouteList, RouteSaveForm, WalkBar } from "./map/RouteSheets";
import { Chip } from "./ui";

type LatLng = [number, number];

/** 지도 아래에 무엇이 떠 있나 */
type Mode =
  | { kind: "idle" }
  | { kind: "pin"; at: LatLng; here?: string }
  | { kind: "pinView"; pin: Pin }
  | { kind: "draw"; points: LatLng[] }
  | { kind: "saveRoute"; route: Pick<Route, "kind" | "points" | "distanceM" | "durationSec"> }
  | { kind: "routes" };

export function MapView() {
  const { data, region, addPin, deletePin, addRoute, deleteRoute } = useStore();
  const walk = useWalk();
  const sync = useSync();
  const el = useRef<HTMLDivElement>(null);
  const adapter = useRef<MapAdapter | null>(null);
  const lastMarkerTap = useRef(0);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const [filter, setFilter] = useState<Set<PinSource>>(new Set(["parent", "observer", "agency"]));
  const [showRoutes, setShowRoutes] = useState(true);
  const [me, setMe] = useState<LatLng | null>(null);
  const [found, setFound] = useState<PlaceResult | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [fellBack, setFellBack] = useState(false);

  // 지도를 열 때마다 팀 기록을 받아 온다
  useEffect(() => {
    void syncNow();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // 지역이 바뀌면 그 지역에 맞는 지도(카카오/구글/OSM)로 다시 만든다
  useEffect(() => {
    let cancelled = false;
    let made: MapAdapter | null = null;
    const host = el.current;
    if (!host) return;
    const inner = document.createElement("div");
    inner.style.cssText = "position:absolute;inset:0";
    host.appendChild(inner);
    setProvider(null);
    createMap(preferredProvider(region), {
      el: inner,
      center: REGIONS.find((r) => r.value === region)!.center,
      onMapClick: (lat, lng) => {
        if (Date.now() - lastMarkerTap.current < 400) return;
        const m = modeRef.current;
        if (m.kind === "draw") setMode({ kind: "draw", points: [...m.points, [lat, lng]] });
        else if (m.kind === "idle" || m.kind === "pin" || m.kind === "pinView") setMode({ kind: "pin", at: [lat, lng] });
      },
    }).then((res) => {
      if (cancelled) {
        res.adapter.destroy();
        return;
      }
      made = res.adapter;
      adapter.current = res.adapter;
      setProvider(res.provider);
      setFellBack(res.fellBack);
    });
    return () => {
      cancelled = true;
      made?.destroy();
      adapter.current = null;
      inner.remove();
      setMode({ kind: "idle" });
      setFound(null);
    };
  }, [region]);

  const pinsHere = data.pins.filter((p) => p.region === region);
  const routesHere = data.routes.filter((r) => r.region === region);
  const walkingHere = walk.active ? walk.points : [];
  const myPos: LatLng | null = walk.points.length ? walk.points[walk.points.length - 1] : me;

  // 핀 다시 그리기
  useEffect(() => {
    if (!adapter.current || !provider) return;
    const shown: MapMarker[] = pinsHere
      .filter((p) => filter.has(p.source))
      .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, color: PIN_SOURCE_META[p.source].color }));
    if (mode.kind === "pin") shown.push({ id: "__draft", lat: mode.at[0], lng: mode.at[1], color: "#fff", variant: "draft" });
    if (mode.kind === "draw")
      mode.points.forEach(([lat, lng], i) => shown.push({ id: `__v${i}`, lat, lng, color: ROUTE_COLOR.drawn, variant: "vertex" }));
    if (found) shown.push({ id: "__found", lat: found.lat, lng: found.lng, color: "#111", variant: "search" });
    if (myPos) shown.push({ id: "__me", lat: myPos[0], lng: myPos[1], color: "#3182f6", variant: "me" });
    adapter.current.setMarkers(shown, (id) => {
      if (id.startsWith("__")) return;
      if (modeRef.current.kind === "draw") return;
      lastMarkerTap.current = Date.now();
      const pin = data.pins.find((p) => p.id === id);
      if (pin) setMode({ kind: "pinView", pin });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.pins, filter, mode, provider, region, found, myPos?.[0], myPos?.[1]]);

  // 경로 다시 그리기
  useEffect(() => {
    if (!adapter.current || !provider) return;
    const lines: MapRoute[] = showRoutes
      ? routesHere.map((r) => ({ id: r.id, points: r.points, color: ROUTE_COLOR[r.kind], dashed: r.kind === "drawn" }))
      : [];
    if (mode.kind === "draw" && mode.points.length > 1)
      lines.push({ id: "__draw", points: mode.points, color: ROUTE_COLOR.drawn, dashed: true });
    if (walkingHere.length > 1) lines.push({ id: "__walk", points: walkingHere, color: ROUTE_COLOR.walked });
    // 저장하기 전에도 방금 그리거나 걸은 길이 보이게
    if (mode.kind === "saveRoute")
      lines.push({ id: "__save", points: mode.route.points, color: ROUTE_COLOR[mode.route.kind], dashed: mode.route.kind === "drawn" });
    adapter.current.setRoutes(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.routes, showRoutes, mode, provider, region, walkingHere.length]);

  const locateOnce = (onFix: (p: LatLng, accuracy: number) => void) => {
    if (!navigator.geolocation) return setNotice("이 브라우저는 위치를 지원하지 않아요.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p: LatLng = [pos.coords.latitude, pos.coords.longitude];
        setMe(p);
        onFix(p, pos.coords.accuracy);
      },
      (err) => {
        setLocating(false);
        setNotice(err.code === err.PERMISSION_DENIED ? "위치 권한을 허용해 주세요." : "위치를 잡지 못했어요. 다시 눌러 주세요.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  };

  /** 현재 위치(걷는 중이면 마지막 GPS 점)에 위험지점 기록 시작 */
  const recordHere = () => {
    if (walk.active && walk.points.length) {
      const at = walk.points[walk.points.length - 1];
      return setMode({ kind: "pin", at, here: `걷는 중 현재 위치 · 정확도 약 ${Math.round(walk.accuracy ?? 0)}m` });
    }
    locateOnce((at, acc) => {
      adapter.current?.setCenter(at[0], at[1], true);
      setMode({ kind: "pin", at, here: `현재 위치 · 정확도 약 ${Math.round(acc)}m` });
    });
  };

  const savePin = async (at: LatLng, d: PinDraft) => {
    const photoIds: string[] = [];
    for (const blob of d.photos) {
      const id = newId();
      await savePhoto(id, blob);
      photoIds.push(id);
    }
    addPin({
      id: newId(),
      createdAt: new Date().toISOString(),
      lat: at[0],
      lng: at[1],
      region,
      source: d.source,
      tags: d.tags,
      memo: d.memo,
      photos: photoIds,
    });
    setMode({ kind: "idle" });
    void syncNow();
  };

  const removePin = (pin: Pin) => {
    deletePin(pin.id);
    void deletePhotos(pin.photos ?? []);
    queueRemoteDelete("pins", pin);
    setMode({ kind: "idle" });
  };

  const finishWalk = () => {
    const r = stopWalk();
    if (!r) return setNotice("기록된 이동이 거의 없어서 저장하지 않았어요.");
    setMode({ kind: "saveRoute", route: { kind: "walked", ...r } });
  };

  const focusRoute = (r: Route) => {
    const mid = r.points[Math.floor(r.points.length / 2)];
    adapter.current?.setCenter(mid[0], mid[1], true);
    setShowRoutes(true);
    setMode({ kind: "idle" });
  };

  const idle = mode.kind === "idle" && !walk.active;

  return (
    <div className="relative h-full">
      <div ref={el} className="absolute inset-0 z-0" />

      {/* 상단: 장소 검색 + 필터 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] space-y-2 p-3">
        <PlaceSearch
          placeholder={region === "taiwan" ? "중국어·영어로 검색 (예: 大安國小, 安親班)" : "학교·돌봄센터·학원 검색"}
          onSearch={(q) => searchPlaces(provider ?? "osm", q, adapter.current?.getCenter() ?? REGIONS.find((r) => r.value === region)!.center)}
          onPick={(p) => {
            setFound(p);
            adapter.current?.setCenter(p.lat, p.lng, true);
          }}
        />
        <div className="flex flex-wrap gap-1.5">
          {PIN_SOURCES.map((s) => (
            <span key={s.value} className="pointer-events-auto">
              <Chip
                active={filter.has(s.value)}
                color={s.color}
                onClick={() => {
                  const next = new Set(filter);
                  if (next.has(s.value)) next.delete(s.value);
                  else next.add(s.value);
                  setFilter(next);
                }}
              >
                {s.label} {pinsHere.filter((p) => p.source === s.value).length}
              </Chip>
            </span>
          ))}
          <span className="pointer-events-auto">
            <Chip active={showRoutes} color="#16a34a" onClick={() => setMode({ kind: "routes" })}>
              경로 {routesHere.length}
            </Chip>
          </span>
        </div>
        {found && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-card bg-card px-3 py-2 shadow-float">
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{found.name}</span>
            <button type="button" className="text-[13px] font-bold text-accent" onClick={() => setMode({ kind: "pin", at: [found.lat, found.lng] })}>
              여기 기록
            </button>
            <button type="button" className="px-1 text-[16px] text-ink-3" aria-label="검색 결과 닫기" onClick={() => setFound(null)}>
              ×
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className="absolute inset-x-6 top-1/3 z-[700] rounded-card bg-ink/90 px-4 py-3 text-center text-[14px] font-medium text-white">
          {notice}
        </div>
      )}

      {/* 내 위치 */}
      {(idle || walk.active) && mode.kind !== "pin" && (
        <button
          type="button"
          onClick={() => locateOnce((p) => adapter.current?.setCenter(p[0], p[1], true))}
          className="absolute right-3 z-[500] flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-float"
          style={{ bottom: `calc(var(--tabbar-h) + ${walk.active ? 152 : 150}px)` }}
          aria-label="내 위치"
        >
          <svg viewBox="0 0 24 24" className={`h-6 w-6 ${locating ? "animate-pulse" : ""}`} fill="none" stroke="#111" strokeWidth="2">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* 하단: 기록 동작 */}
      {idle && (
        <div className="absolute inset-x-3 z-[500] rounded-card bg-card/95 p-2.5 shadow-float" style={{ bottom: "calc(var(--tabbar-h) + 8px)" }}>
          <div className="grid grid-cols-3 gap-1.5">
            <ActionButton primary onClick={recordHere} label={locating ? "위치 잡는 중" : "여기 기록"} icon="pin" />
            <ActionButton onClick={() => setMode({ kind: "draw", points: [] })} label="경로 그리기" icon="draw" />
            <ActionButton onClick={startWalk} label="걸으며 기록" icon="walk" />
          </div>
          <p className="mt-1.5 truncate px-1 text-[11px] text-ink-3">
            지도를 눌러도 추가돼요 · 위험지점 {pinsHere.length} · 경로 {routesHere.length}
            {provider && ` · ${PROVIDER_LABEL[provider]}`}
            {fellBack && " (지도 키 확인 필요)"} · <SyncLabel {...sync} />
          </p>
        </div>
      )}

      {walk.active && mode.kind !== "pin" && <WalkBar walk={walk} onRecordHere={recordHere} onStop={finishWalk} />}

      {mode.kind === "pin" && (
        <PinForm
          key={`${mode.at[0]},${mode.at[1]}`}
          hereLabel={mode.here}
          defaultSource={mode.here ? "observer" : "parent"}
          onCancel={() => setMode({ kind: "idle" })}
          onSave={(d) => void savePin(mode.at, d)}
        />
      )}

      {mode.kind === "pinView" && (
        <PinDetail pin={mode.pin} onClose={() => setMode({ kind: "idle" })} onDelete={() => removePin(mode.pin)} />
      )}

      {mode.kind === "draw" && (
        <DrawBar
          count={mode.points.length}
          distanceM={pathLength(mode.points)}
          onUndo={() => setMode({ kind: "draw", points: mode.points.slice(0, -1) })}
          onCancel={() => setMode({ kind: "idle" })}
          onDone={() =>
            setMode({
              kind: "saveRoute",
              route: { kind: "drawn", points: mode.points, distanceM: Math.round(pathLength(mode.points)) },
            })
          }
        />
      )}

      {mode.kind === "saveRoute" && (
        <RouteSaveForm
          kind={mode.route.kind}
          distanceM={mode.route.distanceM}
          durationSec={mode.route.durationSec}
          onCancel={() => setMode({ kind: "idle" })}
          onSave={(name, memo) => {
            addRoute({ id: newId(), createdAt: new Date().toISOString(), region, name, memo, ...mode.route });
            setMode({ kind: "idle" });
            setNotice(`경로 저장 · ${formatDistance(mode.route.distanceM)}`);
            void syncNow();
          }}
        />
      )}

      {mode.kind === "routes" && (
        <div>
          <RouteList
            routes={routesHere}
            onFocus={focusRoute}
            onDelete={(r) => {
              deleteRoute(r.id);
              queueRemoteDelete("routes", r);
            }}
            onClose={() => setMode({ kind: "idle" })}
          />
          <button
            type="button"
            onClick={() => setShowRoutes(!showRoutes)}
            className="absolute right-3 top-[112px] z-[610] rounded-full bg-card px-3 py-1.5 text-[13px] font-semibold shadow-float"
          >
            지도에 경로 {showRoutes ? "숨기기" : "보이기"}
          </button>
        </div>
      )}
    </div>
  );
}

function SyncLabel({ code, busy, error, lastSync }: { code: string; busy: boolean; error: string | null; lastSync: string | null }) {
  if (!code) return <span>팀 코드 없음 (데이터 탭)</span>;
  if (busy) return <span>팀 공유 중…</span>;
  if (error) return <span className="text-danger">공유 실패 · {error}</span>;
  return <span>팀 공유 {lastSync ? timeAgo(lastSync) : "대기"}</span>;
}

const ICONS = {
  pin: <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  draw: <path d="M5 19c3-1 3-6 7-7s4-6 7-7M5 19h.01M19 5h.01" strokeLinecap="round" />,
  walk: <path d="M13 4.5a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v3M9 12l2-4 4 2 2 3M11 8l-3 1-1 4" strokeLinecap="round" strokeLinejoin="round" />,
};

function ActionButton({ label, icon, onClick, primary }: { label: string; icon: keyof typeof ICONS; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-field text-[13px] font-bold transition active:scale-[0.97] ${
        primary ? "bg-accent text-white" : "bg-grey-100 text-ink"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        {ICONS[icon]}
      </svg>
      {label}
    </button>
  );
}
