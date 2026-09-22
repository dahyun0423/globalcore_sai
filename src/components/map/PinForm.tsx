"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PIN_SOURCES, PIN_TAGS } from "@/lib/constants";
import { shrinkPhoto } from "@/lib/photo-db";
import type { PinSource } from "@/lib/types";
import { Button, Chip, Segmented, Sheet, inputClass } from "../ui";

const MAX_PHOTOS = 3;

export interface PinDraft {
  source: PinSource;
  tags: string[];
  memo: string;
  photos: Blob[];
}

export function PinForm({
  hereLabel,
  defaultSource,
  onSave,
  onCancel,
}: {
  /** "현재 위치" 기록이면 정확도 등 안내 한 줄 */
  hereLabel?: string;
  /** 현장에서 직접 기록하면 팀 관찰, 인터뷰 중 지도에 찍으면 학부모 응답이 기본 */
  defaultSource: PinSource;
  onSave: (d: PinDraft) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState<PinSource>(defaultSource);
  const [tags, setTags] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addPhotos = async (files: FileList) => {
    setBusy(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const shrunk = await Promise.all([...files].slice(0, room).map(shrinkPhoto));
      setPhotos((p) => [...p, ...shrunk]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet>
      <p className="text-[17px] font-bold">위험지점 기록</p>
      {hereLabel && <p className="mt-0.5 text-[12px] text-ink-3">{hereLabel}</p>}

      <div className="mt-3">
        <Segmented value={source} options={PIN_SOURCES} onChange={setSource} size="sm" />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto">
        {photos.map((b, i) => (
          <Thumb key={i} blob={b} onRemove={() => setPhotos(photos.filter((_, j) => j !== i))} />
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-field border border-dashed border-line-strong text-[12px] font-semibold text-ink-2"
          >
            <svg viewBox="0 0 24 24" className="mb-1 h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {busy ? "줄이는 중" : "사진"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-1.5 rounded-chip bg-danger-soft px-2.5 py-1.5 text-[12px] font-medium text-danger">
        장소만 찍어 주세요. 사람·아이 얼굴, 차량 번호판이 나오면 다시 찍기.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PIN_TAGS.map((t) => (
          <Chip
            key={t}
            active={tags.includes(t)}
            color="#dc2626"
            onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
          >
            {t}
          </Chip>
        ))}
      </div>
      <input
        className={`${inputClass} mt-3`}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="한 줄 메모 (예: 하교 시간 학원차 불법주차)"
      />
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          취소
        </Button>
        <Button
          variant="accent"
          className="flex-[2]"
          disabled={!tags.length || busy}
          onClick={() => onSave({ source, tags, memo: memo.trim(), photos })}
        >
          저장
        </Button>
      </div>
    </Sheet>
  );
}

/** 사진 Blob을 <img>에 쓸 주소로. 화면에서 사라지면 메모리를 돌려준다 */
export function useObjectURL(blob: Blob): string {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return url;
}

export function Thumb({ blob, onRemove, onOpen }: { blob: Blob; onRemove?: () => void; onOpen?: () => void }) {
  const url = useObjectURL(blob);
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-field bg-grey-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="위험지점 사진" className="h-full w-full object-cover" onClick={onOpen} />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="사진 빼기"
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[14px] text-white"
        >
          ×
        </button>
      )}
    </div>
  );
}
