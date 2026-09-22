"use client";

import { useEffect, useState } from "react";
import { PIN_SOURCE_META } from "@/lib/constants";
import { formatWhen } from "@/lib/format";
import { photoBlob } from "@/lib/share";
import type { Pin } from "@/lib/types";
import { Button, Sheet } from "../ui";
import { Thumb, useObjectURL } from "./PinForm";

export function PinDetail({ pin, onClose, onDelete }: { pin: Pin; onClose: () => void; onDelete: () => void }) {
  const [photos, setPhotos] = useState<(Blob | null)[]>([]);
  const [big, setBig] = useState<Blob | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all((pin.photos ?? []).map(photoBlob)).then((b) => alive && setPhotos(b));
    return () => {
      alive = false;
    };
  }, [pin.photos]);

  const missing = (pin.photos?.length ?? 0) - photos.filter(Boolean).length;

  return (
    <Sheet>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: PIN_SOURCE_META[pin.source].color }} />
        <span className="text-[15px] font-semibold">{PIN_SOURCE_META[pin.source].label}</span>
        <span className="ml-auto text-[12px] text-ink-3">
          {formatWhen(pin.createdAt)} · {pin.synced ? "팀 공유됨" : "이 폰에만"}
        </span>
      </div>

      {!!pin.photos?.length && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {photos.map((b, i) => b && <Thumb key={i} blob={b} onOpen={() => setBig(b)} />)}
          {missing > 0 && photos.length > 0 && (
            <p className="self-center text-[12px] text-ink-3">사진 {missing}장은 팀 코드를 넣고 동기화하면 보여요</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {pin.tags.map((t) => (
          <span key={t} className="rounded-full bg-danger-soft px-2.5 py-1 text-[13px] font-medium text-danger">
            {t}
          </span>
        ))}
      </div>
      {pin.memo && <p className="mt-2 text-[15px]">{pin.memo}</p>}

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          닫기
        </Button>
        <Button variant="danger" className="flex-1" onClick={() => (confirm ? onDelete() : setConfirm(true))}>
          {confirm ? "팀 지도에서도 지워요" : "삭제"}
        </Button>
      </div>

      {big && <PhotoViewer blob={big} onClose={() => setBig(null)} />}
    </Sheet>
  );
}

function PhotoViewer({ blob, onClose }: { blob: Blob; onClose: () => void }) {
  const url = useObjectURL(blob);
  return (
    <button type="button" onClick={onClose} className="fixed inset-0 z-[900] flex items-center justify-center bg-black/90">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="위험지점 사진 크게 보기" className="max-h-full max-w-full object-contain" />
    </button>
  );
}
