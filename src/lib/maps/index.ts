import type { Region } from "../types";
import { createGoogle, searchGoogle } from "./google";
import { createKakao, searchKakao } from "./kakao";
import { createLeaflet, searchOSM } from "./leaflet";
import type { MapAdapter, MapOptions, PlaceResult, ProviderId } from "./types";

export * from "./types";

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

/** 한국은 카카오맵, 대만은 구글 지도. 키가 없으면 OpenStreetMap */
export function preferredProvider(region: Region): ProviderId {
  if (region === "taiwan") return GOOGLE_KEY ? "google" : "osm";
  return KAKAO_KEY ? "kakao" : "osm";
}

/**
 * 지도가 하단 메뉴바 뒤까지 깔리므로, 카카오·구글이 지도 맨 아래에 붙이는 로고·축척·약관 표시를 메뉴바 위로 올린다.
 * (로고를 가리면 지도 이용약관 위반) 이 표시들은 늦게 붙기도 해서 계속 지켜본다.
 */
function liftBottomChrome(host: HTMLElement): () => void {
  const lift = () => {
    const hostBottom = host.getBoundingClientRect().bottom;
    for (const el of host.querySelectorAll<HTMLElement>("div, a")) {
      if (el.dataset.lifted || el.parentElement?.closest("[data-lifted]")) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "absolute" || cs.bottom !== "0px") continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.height > 40 || r.width > 440 || Math.abs(r.bottom - hostBottom) > 2) continue;
      el.dataset.lifted = "1";
      el.style.bottom = "var(--map-chrome-bottom)";
    }
  };
  let raf = 0;
  const mo = new MutationObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(lift);
  });
  mo.observe(host, { childList: true, subtree: true });
  lift();
  return () => {
    cancelAnimationFrame(raf);
    mo.disconnect();
  };
}

function withLift(adapter: MapAdapter, host: HTMLElement): MapAdapter {
  const stop = liftBottomChrome(host);
  return {
    ...adapter,
    destroy() {
      stop();
      adapter.destroy();
    },
  };
}

export async function createMap(
  provider: ProviderId,
  opts: MapOptions,
): Promise<{ adapter: MapAdapter; provider: ProviderId; fellBack: boolean }> {
  try {
    if (provider === "kakao") return { adapter: withLift(await createKakao(KAKAO_KEY, opts), opts.el), provider, fellBack: false };
    if (provider === "google") return { adapter: withLift(await createGoogle(GOOGLE_KEY, opts), opts.el), provider, fellBack: false };
  } catch {
    opts.el.innerHTML = "";
    return { adapter: await createLeaflet(opts), provider: "osm", fellBack: true };
  }
  return { adapter: await createLeaflet(opts), provider: "osm", fellBack: false };
}

/** 지금 떠 있는 지도와 같은 회사의 장소 검색을 쓴다 (한국=카카오, 대만=구글, 키 없음=OSM) */
export function searchPlaces(provider: ProviderId, query: string, near: [number, number]): Promise<PlaceResult[]> {
  if (provider === "kakao") return searchKakao(KAKAO_KEY, query, near);
  if (provider === "google") return searchGoogle(GOOGLE_KEY, query, near);
  return searchOSM(query, near);
}
