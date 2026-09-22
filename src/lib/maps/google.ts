/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadScript, markerStyle, type MapAdapter, type MapOptions, type PlaceResult } from "./types";

async function loadGoogle(apiKey: string): Promise<any> {
  const w = window as any;
  if (!w.google?.maps?.Map) {
    await new Promise<void>((resolve, reject) => {
      w.__fieldkitGmapsReady = () => resolve();
      loadScript(
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=ko&region=TW&loading=async&callback=__fieldkitGmapsReady`,
        "google-maps-sdk",
      ).catch(reject);
      // 키가 잘못되면 콜백이 안 오므로 시간 제한
      setTimeout(() => reject(new Error("google maps timeout")), 12000);
    });
  }
  return w.google.maps;
}

export async function createGoogle(apiKey: string, { el, center, onMapClick }: MapOptions): Promise<MapAdapter> {
  const g = await loadGoogle(apiKey);
  const map = new g.Map(el, {
    center: { lat: center[0], lng: center[1] },
    zoom: 15,
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: "greedy",
  });
  map.addListener("click", (e: any) => e.latLng && onMapClick(e.latLng.lat(), e.latLng.lng()));
  let markers: any[] = [];
  let lines: any[] = [];

  return {
    setCenter(lat, lng, zoomIn) {
      map.setCenter({ lat, lng });
      if (zoomIn) map.setZoom(17);
    },
    getCenter() {
      const c = map.getCenter();
      return [c.lat(), c.lng()];
    },
    setMarkers(list, onClick) {
      markers.forEach((m) => m.setMap(null));
      markers = list.map((m) => {
        const st = markerStyle(m);
        const marker = new g.Marker({
          map,
          position: { lat: m.lat, lng: m.lng },
          zIndex: m.variant === "me" || m.variant === "search" ? 30 : 20,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: st.size / 2,
            fillColor: st.fill,
            fillOpacity: 0.95,
            strokeColor: st.stroke,
            strokeWeight: st.border,
          },
        });
        marker.addListener("click", () => onClick(m.id));
        return marker;
      });
    },
    setRoutes(routes) {
      lines.forEach((l) => l.setMap(null));
      lines = routes.map(
        (r) =>
          new g.Polyline({
            map,
            path: r.points.map(([lat, lng]) => ({ lat, lng })),
            strokeColor: r.color,
            strokeWeight: 5,
            // 구글 지도는 점선 옵션이 없어서 짧은 선 기호를 반복해 그린다
            strokeOpacity: r.dashed ? 0 : 0.85,
            icons: r.dashed
              ? [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, scale: 3 }, offset: "0", repeat: "14px" }]
              : undefined,
          }),
      );
    },
    destroy() {
      markers.forEach((m) => m.setMap(null));
      lines.forEach((l) => l.setMap(null));
      el.innerHTML = "";
    },
  };
}

/** Places API (New) 텍스트 검색. 키 제한에 Places API (New)가 켜져 있어야 한다 */
export async function searchGoogle(apiKey: string, query: string, near: [number, number]): Promise<PlaceResult[]> {
  const g = await loadGoogle(apiKey);
  const { Place } = await g.importLibrary("places");
  const { places } = await Place.searchByText({
    textQuery: query,
    fields: ["id", "displayName", "formattedAddress", "location"],
    locationBias: { lat: near[0], lng: near[1] },
    maxResultCount: 8,
    language: "ko",
  });
  return (places ?? []).map((p: any) => ({
    id: p.id,
    name: p.displayName ?? "",
    address: p.formattedAddress ?? "",
    lat: p.location.lat(),
    lng: p.location.lng(),
  }));
}
