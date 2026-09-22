import { timingSafeEqual } from "node:crypto";
import * as z from "zod/v4";

/**
 * 팀 공유 저장소는 비공개(private) Blob이고, 팀 코드를 아는 사람만 이 API로 읽고 쓸 수 있다.
 * 코드는 서버 환경변수 TEAM_CODE에만 있다.
 */
export function teamGuard(request: Request): Response | null {
  const expected = process.env.TEAM_CODE;
  if (!expected) return Response.json({ error: "서버에 팀 코드가 설정되지 않았어요." }, { status: 503 });
  const given = request.headers.get("x-team-code") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return Response.json({ error: "팀 코드가 맞지 않아요." }, { status: 401 });
  return null;
}

export const ID = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
const Region = z.enum(["jeju", "taiwan", "seoul"]);
const LatLng = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);

export const PinSchema = z.object({
  id: ID,
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  region: Region,
  source: z.enum(["parent", "observer", "agency"]),
  tags: z.array(z.string().max(40)).max(20),
  memo: z.string().max(1000),
  photos: z.array(ID).max(6).optional(),
});

export const RouteSchema = z.object({
  id: ID,
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40).optional(),
  region: Region,
  kind: z.enum(["drawn", "walked"]),
  name: z.string().max(80),
  points: z.array(LatLng).min(2).max(5000),
  distanceM: z.number().min(0),
  durationSec: z.number().min(0).optional(),
  memo: z.string().max(1000),
});

export const KIND = z.enum(["pins", "routes"]);
export const sharePath = (kind: "pins" | "routes", id: string) => `share/${kind}/${id}.json`;
export const photoPath = (id: string) => `photos/${id}.jpg`;
