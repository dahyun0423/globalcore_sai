import Anthropic from "@anthropic-ai/sdk";
import { AIUnavailable } from "./ai";

export function errorResponse(e: unknown) {
  if (e instanceof AIUnavailable) return Response.json({ error: e.message }, { status: 503 });
  if (e instanceof Anthropic.RateLimitError)
    return Response.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  if (e instanceof Anthropic.AuthenticationError)
    return Response.json({ error: "API 키가 올바르지 않습니다." }, { status: 503 });
  if (e instanceof Anthropic.APIConnectionError)
    return Response.json({ error: "AI 서버에 연결하지 못했습니다. 네트워크를 확인해 주세요." }, { status: 502 });
  if (e instanceof Anthropic.APIError)
    return Response.json({ error: `AI 오류 (${e.status ?? "?"})` }, { status: 502 });
  const message = e instanceof Error ? e.message : "알 수 없는 오류";
  return Response.json({ error: message }, { status: 500 });
}
