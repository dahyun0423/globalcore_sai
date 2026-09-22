/**
 * pin: 저장된 위험지점 · draft: 추가 중인 지점 · me: 내 위치 · search: 검색한 장소 · vertex: 그리는 중인 경로의 점
 */
export type MarkerVariant = "pin" | "draft" | "me" | "search" | "vertex";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color: string;
  variant?: MarkerVariant;
}

export interface MapRoute {
  id: string;
  points: [number, number][];
  color: string;
  /** 그리는 중이거나 그린 경로(걸은 게 아닌 것)는 점선 */
  dashed?: boolean;
}

export interface MapAdapter {
  setCenter(lat: number, lng: number, zoomIn?: boolean): void;
  getCenter(): [number, number];
  setMarkers(markers: MapMarker[], onClick: (id: string) => void): void;
  setRoutes(routes: MapRoute[]): void;
  destroy(): void;
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface MapOptions {
  el: HTMLElement;
  center: [number, number];
  onMapClick: (lat: number, lng: number) => void;
}

export type ProviderId = "kakao" | "google" | "osm";

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  kakao: "카카오맵",
  google: "구글 지도",
  osm: "OpenStreetMap",
};

/** 세 지도가 같은 모양을 쓰도록 마커 모양을 한 곳에서 정한다 */
export function markerStyle(m: MapMarker) {
  switch (m.variant ?? "pin") {
    case "draft":
      return { size: 26, fill: "rgba(255,255,255,.85)", stroke: "#111", border: 3, dashed: true };
    case "me":
      return { size: 18, fill: "#3182f6", stroke: "#fff", border: 3, dashed: false };
    case "search":
      return { size: 24, fill: "#111", stroke: "#fff", border: 4, dashed: false };
    case "vertex":
      return { size: 12, fill: m.color, stroke: "#fff", border: 2, dashed: false };
    default:
      return { size: 22, fill: m.color, stroke: "#fff", border: 3, dashed: false };
  }
}

/** 지도 위 동그라미 핀. 세 지도 모두 같은 모양을 쓰도록 DOM으로 만든다 */
export function dotElement(m: MapMarker, onClick: () => void): HTMLElement {
  const d = document.createElement("div");
  const st = markerStyle(m);
  d.style.cssText = `width:${st.size}px;height:${st.size}px;border-radius:50%;box-sizing:border-box;cursor:pointer;
    background:${st.fill};border:${st.border}px ${st.dashed ? "dashed" : "solid"} ${st.stroke};
    box-shadow:0 1px 4px rgba(0,0,0,.35);${m.variant === "me" ? "outline:6px solid rgba(49,130,246,.2);" : ""}`;
  d.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return d;
}

export function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded) resolve();
      else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("script error")));
      }
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => {
      s.remove();
      reject(new Error("script error"));
    };
    document.head.appendChild(s);
  });
}

/** 경로 길이(m). 위경도 두 점 사이 거리를 이어 더한다 */
export function pathLength(points: [number, number][]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += distance(points[i - 1], points[i]);
  return m;
}

export function distance([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
