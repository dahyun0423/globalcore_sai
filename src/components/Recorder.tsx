"use client";

import { useEffect, useRef, useState } from "react";
import { saveClip } from "@/lib/audio-db";
import { CORE_QUESTIONS, OTHER_QUESTION_LABEL, SPEECH_LANGS } from "@/lib/constants";
import { Segmented } from "./ui";

/* Web Speech API는 TS 기본 타입에 없어서 필요한 만큼만 선언 */
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative; length: number }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SRErrorEvent { error: string }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SRCtor = new () => SpeechRecognitionLike;

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Mode = "both" | "text" | "audio";

/**
 * 녹음·받아쓰기가 안 되는 환경을 미리 알려준다.
 * - http 주소(예: 같은 와이파이 IP)는 브라우저가 마이크를 막는다
 * - 카카오톡·인스타 등 앱 안 브라우저는 마이크·음성 인식을 거의 지원하지 않는다
 */
function environmentProblem(): string | null {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent;
  if (/KAKAOTALK|Instagram|NAVER|FBAN|FBAV|Line\//i.test(ua))
    return "카카오톡 같은 앱 안에서 열면 녹음·받아쓰기가 안 돼요. 오른쪽 아래(또는 위) ⋯ 메뉴 → '다른 브라우저로 열기'로 Safari(아이폰)·Chrome(안드로이드)에서 열어 주세요.";
  if (!window.isSecureContext)
    return "https 주소에서만 마이크가 켜져요. https://globalcore-five.vercel.app 로 열어 주세요.";
  if (!navigator.mediaDevices?.getUserMedia) return "이 브라우저는 녹음을 지원하지 않아요. Safari나 Chrome으로 열어 주세요.";
  return null;
}

const QUESTIONS = [...CORE_QUESTIONS, OTHER_QUESTION_LABEL];

export function Recorder({
  showQuestions,
  interviewId,
  answers,
  onAnswers,
  onClipSaved,
  defaultLang,
}: {
  showQuestions: boolean;
  interviewId: string;
  answers: string[];
  onAnswers: (a: string[]) => void;
  onClipSaved: () => void;
  defaultLang: string;
}) {
  const [active, setActive] = useState(0);
  const [lang, setLang] = useState(defaultLang);
  const [mode, setMode] = useState<Mode>("both");
  const [running, setRunning] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const srSupported = !!getSR();
  const envProblem = environmentProblem();

  const activeRef = useRef(active);
  const answersRef = useRef(answers);
  const runningRef = useRef(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => () => stopAll(), []);

  const append = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const q = activeRef.current;
    const next = [...answersRef.current];
    next[q] = next[q] ? `${next[q]} ${clean}` : clean;
    answersRef.current = next;
    onAnswers(next);
  };

  const startSpeech = () => {
    const SR = getSR();
    if (!SR) return;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) append(r[0].transcript);
        else live += r[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setError("마이크·음성 인식 권한이 꺼져 있어요. 설정 > Safari > 마이크, 설정 > 개인정보 보호 > 음성 인식을 확인해 주세요.");
      else if (e.error === "audio-capture")
        setError("마이크를 녹음과 같이 쓰지 못했어요. 모드를 '받아쓰기만'으로 바꿔 보세요.");
      else if (e.error === "network") setError("받아쓰기에 인터넷 연결이 필요해요.");
      else setError(`받아쓰기 오류: ${e.error}`);
    };
    // iOS·크롬 모두 조용하면 알아서 끝나므로, 녹음 중이면 다시 켠다
    rec.onend = () => {
      setInterim("");
      if (runningRef.current) {
        try {
          rec.start();
        } catch {}
      }
    };
    recRef.current = rec;
    rec.start();
  };

  const startAudio = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(
      (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
    );
    const media = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    media.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    media.onstop = async () => {
      if (!chunks.length) return;
      try {
        await saveClip(interviewId, new Blob(chunks, { type: media.mimeType }));
        onClipSaved();
      } catch {
        setError("녹음 파일을 저장하지 못했어요 (폰 저장공간 확인).");
      }
    };
    media.start(5000);
    mediaRef.current = media;
  };

  const start = async () => {
    if (envProblem) {
      setError(envProblem);
      return;
    }
    setError(null);
    setElapsed(0);
    runningRef.current = true;
    setRunning(true);
    try {
      if (mode !== "text") await startAudio();
      if (mode !== "audio") startSpeech();
    } catch {
      setError("마이크를 켜지 못했어요. 브라우저 마이크 권한을 허용해 주세요.");
      stopAll();
    }
  };

  function stopAll() {
    runningRef.current = false;
    setRunning(false);
    setInterim("");
    try {
      recRef.current?.stop();
    } catch {}
    recRef.current = null;
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    mediaRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  const modes: { value: Mode; label: string }[] = [
    { value: "both", label: "녹음+받아쓰기" },
    { value: "text", label: "받아쓰기만" },
    { value: "audio", label: "녹음만" },
  ];

  const questionsUI = (
    <div className={showQuestions ? "" : "hidden"}>
      {!running && (
        <div className="space-y-2">
          <Segmented value={mode} options={srSupported ? modes : modes.slice(2)} onChange={setMode} size="sm" />
          {mode !== "audio" && (
            <Segmented value={lang} options={SPEECH_LANGS} onChange={setLang} size="sm" />
          )}
          {envProblem && (
            <p className="rounded-chip bg-danger-soft px-2.5 py-2 text-[13px] font-medium text-danger">{envProblem}</p>
          )}
          {!envProblem && !srSupported && (
            <p className="text-[12px] text-ink-3">
              이 브라우저는 자동 받아쓰기를 지원하지 않아요. 아이폰은 Safari로 열어 주세요.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {QUESTIONS.map((q, i) => {
          const isActive = active === i;
          return (
            <div
              key={i}
              className={`rounded-card border-2 bg-card transition ${
                isActive ? "border-accent" : "border-transparent"
              }`}
            >
              <button type="button" onClick={() => setActive(i)} className="flex w-full items-start gap-2.5 p-3 text-left">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                    isActive ? "bg-accent text-white" : "bg-grey-100 text-ink-2"
                  }`}
                >
                  {i < CORE_QUESTIONS.length ? `Q${i + 1}` : "+"}
                </span>
                <span className={`text-[15px] leading-snug ${isActive ? "font-semibold" : "text-ink-2"}`}>{q}</span>
              </button>
              {(isActive || answers[i]) && (
                <div className="px-3 pb-3">
                  <textarea
                    value={answers[i] ?? ""}
                    onChange={(e) => {
                      const next = [...answers];
                      next[i] = e.target.value;
                      onAnswers(next);
                    }}
                    rows={isActive ? 4 : 2}
                    placeholder={isActive ? (running ? "말하면 여기에 적혀요…" : "녹음을 시작하거나 직접 적어도 돼요") : ""}
                    className="w-full resize-none rounded-chip bg-surface-2 p-2.5 text-[15px] leading-relaxed outline-none"
                  />
                  {isActive && interim && <p className="mt-1 text-[14px] text-ink-3">{interim}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 rounded-field bg-danger-soft p-3 text-[13px] text-danger">{error}</p>}
    </div>
  );

  return (
    <>
      {questionsUI}
      {/* 하단 고정 녹음 바 — 다른 단계에서도 보임 */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-line bg-card/95 px-4 pt-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={running ? stopAll : start}
            aria-label={running ? "정지" : "녹음 시작"}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${running ? "bg-danger" : "bg-ink"}`}
          >
            {running ? (
              <span className="h-5 w-5 rounded-[4px] bg-card" />
            ) : (
              <span className="h-5 w-5 rounded-full bg-danger" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">
              {running ? `Q${active + 1 > CORE_QUESTIONS.length ? "+" : active + 1}에 기록 중` : "질문을 누른 뒤 녹음"}
            </p>
            <p className="text-[13px] tabular-nums text-ink-3">
              {running
                ? `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")} · 질문을 누르면 거기로 이어서 적혀요`
                : modes.find((m) => m.value === mode)?.label}
            </p>
          </div>
          {running && (
            <button
              type="button"
              onClick={() => setActive((a) => Math.min(a + 1, QUESTIONS.length - 1))}
              className="rounded-full bg-grey-100 px-4 py-2.5 text-[14px] font-semibold"
            >
              다음 질문
            </button>
          )}
        </div>
        {!showQuestions && error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </div>
    </>
  );
}
