/* eslint-disable @typescript-eslint/no-explicit-any */
import { dotElement, loadScript, type MapAdapter, type MapOptions, type PlaceResult } from "./types";

async function loadKakao(appKey: string): Promise<any> {
  await loadScript(
    `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`,
    "kakao-maps-sdk",
  );
  const kakao = (window as any).kakao;
  if (!kakao?.maps) throw new Error("kakao sdk missing");
  await new Promise<void>((resolve) => kakao.maps.load(() => resolve()));
  return kakao;
}

export async function createKakao(appKey: string, { el, center, onMapClick }: MapOptions): Promise<MapAdapter> {
  const kakao = await loadKakao(appKey);
  const LatLng = kakao.maps.LatLng;

  const map = new kakao.maps.Map(el, {
    center: new LatLng(center[0], center[1]),
    level: 4,
  });
  kakao.maps.event.addListener(map, "click", (e: any) => onMapClick(e.latLng.getLat(), e.latLng.getLng()));
  // 메뉴바를 띄우거나 화면이 돌아가 크기가 바뀌면 다시 그린다 (카카오는 알아서 안 함)
  const ro = new ResizeObserver(() => map.relayout());
  ro.observe(el);
  let overlays: any[] = [];
  let lines: any[] = [];

  return {
    setCenter(lat, lng, zoomIn) {
      if (zoomIn) map.setLevel(2);
      map.setCenter(new LatLng(lat, lng));
    },
    getCenter() {
      const c = map.getCenter();
      return [c.getLat(), c.getLng()];
    },
    setMarkers(markers, onClick) {
      overlays.forEach((o) => o.setMap(null));
      overlays = markers.map(
        (m) =>
          new kakao.maps.CustomOverlay({
            map,
            position: new LatLng(m.lat, m.lng),
            content: dotElement(m, () => onClick(m.id)),
            xAnchor: 0.5,
            yAnchor: 0.5,
            clickable: true,
            zIndex: m.variant === "me" || m.variant === "search" ? 3 : 2,
          }),
      );
    },
    setRoutes(routes) {
      lines.forEach((l) => l.setMap(null));
      lines = routes.map(
        (r) =>
          new kakao.maps.Polyline({
            map,
            path: r.points.map(([la, ln]) => new LatLng(la, ln)),
            strokeWeight: 5,
            strokeColor: r.color,
            strokeOpacity: 0.85,
            strokeStyle: r.dashed ? "shortdash" : "solid",
          }),
      );
    },
    destroy() {
      ro.disconnect();
      overlays.forEach((o) => o.setMap(null));
      lines.forEach((l) => l.setMap(null));
      el.innerHTML = "";
    },
  };
}

export async function searchKakao(appKey: string, query: string, near: [number, number]): Promise<PlaceResult[]> {
  const kakao = await loadKakao(appKey);
  const places = new kakao.maps.services.Places();
  return new Promise((resolve) => {
    places.keywordSearch(
      query,
      (data: any[], status: string) => {
        if (status !== kakao.maps.services.Status.OK) return resolve([]);
        resolve(
          data.slice(0, 8).map((d) => ({
            id: d.id,
            name: d.place_name,
            address: d.road_address_name || d.address_name,
            lat: Number(d.y),
            lng: Number(d.x),
          })),
        );
      },
      { location: new kakao.maps.LatLng(near[0], near[1]), sort: kakao.maps.services.SortBy.ACCURACY },
    );
  });
}
