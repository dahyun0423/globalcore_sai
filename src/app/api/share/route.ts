import { del, get, list, put } from "@vercel/blob";
import { KIND, PinSchema, RouteSchema, ID, photoPath, sharePath, teamGuard } from "@/lib/team";

/*
 * 팀 공유 위험지점·경로. 기록 1개 = 파일 1개(share/{pins|routes}/{id}.json)라서
 * 두 사람이 동시에 올려도 서로 덮어쓰지 않는다.
 */

async function readAll(prefix: string): Promise<unknown[]> {
  const out: unknown[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    const docs = await Promise.all(
      page.blobs.map(async (b) => {
        const r = await get(b.pathname, { access: "private", useCache: false });
        if (!r?.stream) return null;
        try {
          return JSON.parse(await new Response(r.stream).text());
        } catch {
          return null;
        }
      }),
    );
    out.push(...docs.filter(Boolean));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

export async function GET(request: Request) {
  const denied = teamGuard(request);
  if (denied) return denied;
  const [pins, routes] = await Promise.all([readAll("share/pins/"), readAll("share/routes/")]);
  return Response.json({
    pins: pins.flatMap((p) => {
      const r = PinSchema.safeParse(p);
      return r.success ? [r.data] : [];
    }),
    routes: routes.flatMap((p) => {
      const r = RouteSchema.safeParse(p);
      return r.success ? [r.data] : [];
    }),
  });
}

export async function POST(request: Request) {
  const denied = teamGuard(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { kind?: unknown; item?: unknown } | null;
  const kind = KIND.safeParse(body?.kind);
  if (!kind.success) return Response.json({ error: "kind가 없어요." }, { status: 400 });
  const parsed = (kind.data === "pins" ? PinSchema : RouteSchema).safeParse(body?.item);
  if (!parsed.success) return Response.json({ error: "기록 형식이 맞지 않아요." }, { status: 400 });

  await put(sharePath(kind.data, parsed.data.id), JSON.stringify(parsed.data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const denied = teamGuard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const kind = KIND.safeParse(url.searchParams.get("kind"));
  const id = ID.safeParse(url.searchParams.get("id"));
  if (!kind.success || !id.success) return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });

  const path = sharePath(kind.data, id.data);
  const targets = [path];
  // 위험지점을 지우면 그 사진도 같이 지운다
  if (kind.data === "pins") {
    const r = await get(path, { access: "private", useCache: false });
    if (r?.stream) {
      const pin = PinSchema.safeParse(await new Response(r.stream).json().catch(() => null));
      if (pin.success) targets.push(...(pin.data.photos ?? []).map(photoPath));
    }
  }
  await del(targets);
  return Response.json({ ok: true });
}
