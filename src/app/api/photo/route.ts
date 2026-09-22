import { get, put } from "@vercel/blob";
import { ID, photoPath, teamGuard } from "@/lib/team";

/** 사진은 폰에서 이미 1600px JPEG로 줄여서 온다 */
const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request) {
  const denied = teamGuard(request);
  if (denied) return denied;
  const form = await request.formData().catch(() => null);
  const id = ID.safeParse(form?.get("id"));
  const file = form?.get("file");
  if (!id.success || !(file instanceof Blob)) return Response.json({ error: "사진이 없어요." }, { status: 400 });
  if (file.type !== "image/jpeg" || file.size > MAX_BYTES)
    return Response.json({ error: "JPEG 3MB 이하만 올릴 수 있어요." }, { status: 400 });

  await put(photoPath(id.data), file, {
    access: "private",
    contentType: "image/jpeg",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  const denied = teamGuard(request);
  if (denied) return denied;
  const id = ID.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });

  const r = await get(photoPath(id.data), { access: "private" });
  if (!r?.stream) return Response.json({ error: "사진이 없어요." }, { status: 404 });
  return new Response(r.stream, {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
  });
}
