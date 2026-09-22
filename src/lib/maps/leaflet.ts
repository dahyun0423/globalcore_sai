import type * as Lf from "leaflet";
import { dotElement, markerStyle, type MapAdapter, type MapOptions, type PlaceResult } from "./types";

export async function createLeaflet({ el, center, onMapClick }: MapOptions): Promise<MapAdapter> {
  const mod = await import("leaflet");
  const L = (mod.default ?? mod) as typeof Lf;
  const map = L.map(el, { zoomControl: false }).setView(center, 15);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);
  const lineLayer = L.layerGroup().addTo(map);
  const layer = L.layerGroup().addTo(map);
  map.on("click", (e: Lf.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng));
  const ro = new ResizeObserver(() => map.invalidateSize());
  ro.observe(el);

  return {
    setCenter(lat, lng, zoomIn) {
      map.setView([lat, lng], zoomIn ? 17 : map.getZoom());
    },
    getCenter() {
      const c = map.getCenter();
      return [c.lat, c.lng];
    },
    setMarkers(markers, onClick) {
      layer.clearLayers();
      for (const m of markers) {
        const size = markerStyle(m).size;
        const icon = L.divIcon({
          html: dotElement(m, () => onClick(m.id)),
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker([m.lat, m.lng], { icon, interactive: true }).addTo(layer);
      }
    },
    setRoutes(routes) {
      lineLayer.clearLayers();
      for (const r of routes)
        L.polyline(r.points, { color: r.color, weight: 5, opacity: 0.85, dashArray: r.dashed ? "8 8" : undefined }).addTo(
          lineLayer,
        );
    },
    destroy() {
      ro.disconnect();
      map.remove();
    },
  };
}

/** 지도 키가 없을 때 쓰는 OpenStreetMap 검색(Nominatim). 요청을 아껴 써야 해서 검색 버튼을 눌렀을 때만 부른다 */
export async function searchOSM(query: string, near: [number, number]): Promise<PlaceResult[]> {
  const d = 0.1;
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "8",
    "accept-language": "ko",
    viewbox: `${near[1] - d},${near[0] + d},${near[1] + d},${near[0] - d}`,
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) return [];
  const list = (await res.json()) as { place_id: number; name: string; display_name: string; lat: string; lon: string }[];
  return list.map((p) => ({
    id: String(p.place_id),
    name: p.name || p.display_name.split(",")[0],
    address: p.display_name,
    lat: Number(p.lat),
    lng: Number(p.lon),
  }));
}
