"use client";

import { useState } from "react";
import type { PlaceResult } from "@/lib/maps";

/** 지도 위 검색창. 학교·돌봄센터·학원을 찾아 그 위치로 옮긴다 */
export function PlaceSearch({
  placeholder,
  onSearch,
  onPick,
}: {
  placeholder: string;
  onSearch: (q: string) => Promise<PlaceResult[]>;
  onPick: (p: PlaceResult) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const run = async () => {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setError(false);
    try {
      setResults(await onSearch(query));
    } catch {
      setError(true);
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto">
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value) setResults(null);
          }}
          enterKeyHint="search"
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2.5 text-[15px] shadow-float outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ink px-4 text-[14px] font-bold text-white shadow-float disabled:opacity-50"
        >
          {busy ? "…" : "검색"}
        </button>
      </form>
      {results && (
        <div className="mt-1.5 max-h-[45vh] overflow-y-auto rounded-card bg-card shadow-float">
          {results.length === 0 && (
            <p className="px-4 py-3 text-[14px] text-ink-3">{error ? "검색하지 못했어요. 인터넷을 확인해 주세요." : "결과가 없어요."}</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onPick(r);
                setResults(null);
              }}
              className="block w-full border-b border-line px-4 py-2.5 text-left last:border-0 active:bg-surface-hover"
            >
              <span className="block text-[15px] font-semibold">{r.name}</span>
              <span className="block truncate text-[12px] text-ink-3">{r.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
