import { compareRegions } from "@/lib/ai";
import { errorResponse } from "@/lib/ai-errors";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return Response.json({ error: "비교할 데이터가 없습니다." }, { status: 400 });
  const size = JSON.stringify(body).length;
  if (size > 200000)
    return Response.json({ error: "데이터가 너무 큽니다." }, { status: 400 });

  try {
    const result = await compareRegions(body);
    return Response.json({ comparison: { ...result, generatedAt: new Date().toISOString() } });
  } catch (e) {
    return errorResponse(e);
  }
}
