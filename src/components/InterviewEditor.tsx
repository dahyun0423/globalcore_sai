"use client";

import { useEffect, useRef, useState } from "react";
import { deleteClips, listClips, type Clip } from "@/lib/audio-db";
import {
  CONCEPTS,
  CORE_QUESTIONS,
  OTHER_QUESTION_LABEL,
  REGIONS,
  REGION_LABEL,
  RESPONDENTS,
  RESPONDENT_LABEL,
} from "@/lib/constants";
import { useStore } from "@/lib/store";
import type { Analysis, Interview } from "@/lib/types";
import { Recorder } from "./Recorder";
import { ServicePreview } from "./ServicePreview";
import { summarizeInterview } from "@/lib/summary";
import { Timeline } from "./Timeline";
import { Button, Card, Check, Field, Segmented, inputClass } from "./ui";

const STEPS = ["동의", "기본", "질문·녹음", "하루 그리기", "서비스 보여주기", "정리"] as const;

export function InterviewEditor({ initial, onClose }: { initial: Interview; onClose: () => void }) {
  const { upsertInterview, deleteInterview } = useStore();
  const [iv, setIv] = useState<Interview>(initial);
  const [step, setStep] = useState(initial.consent.explained ? 2 : 0);
  const [preview, setPreview] = useState(false);
  const ivRef = useRef(iv);
  const scroller = useRef<HTMLDivElement>(null);

  // 변경될 때마다 바로 저장 (현장에서 앱이 꺼져도 남도록)
  const update = (patch: Partial<Interview>) => {
    const next = { ...ivRef.current, ...patch };
    ivRef.current = next;
    setIv(next);
    upsertInterview(next);
  };

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [step]);

  const consentOk = iv.consent.explained && iv.consent.anonymous && iv.consent.noChild;
  const canGo = (s: number) => s === 0 || consentOk;

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[430px] flex-col bg-bg">
      {/* 상단 바 */}
      <div className="pt-safe border-b border-line bg-card/95 px-4 pb-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="-ml-1 py-1 pr-3 text-[17px] text-accent">
            ‹ 목록
          </button>
          <span className="text-[15px] font-semibold">
            {REGION_LABEL[iv.region]} · {RESPONDENT_LABEL[iv.respondent]}
          </span>
          <span className="w-12 text-right text-[12px] text-ink-3">자동저장</span>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              disabled={!canGo(i)}
              onClick={() => setStep(i)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold disabled:opacity-30 ${
                step === i ? "bg-ink text-white" : "bg-grey-100 text-ink-2"
              }`}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 pb-8 pt-3">
        {step === 0 && (
          <div>
            <Card>
              <p className="text-[17px] font-bold">시작 전에 꼭 확인</p>
              <p className="mt-1 text-[14px] text-ink-2">아래 세 가지를 설명하고 체크해야 다음으로 넘어가요.</p>
              <div className="mt-2 divide-y divide-line">
                <Check
                  checked={iv.consent.explained}
                  onChange={(v) => update({ consent: { ...iv.consent, explained: v } })}
                >
                  서경대 Global CORE 연구 목적이라고 설명했어요
                </Check>
                <Check
                  checked={iv.consent.anonymous}
                  onChange={(v) => update({ consent: { ...iv.consent, anonymous: v } })}
                >
                  이름·연락처는 받지 않고 익명으로 정리한다고 안내했어요
                </Check>
                <Check checked={iv.consent.noChild} onChange={(v) => update({ consent: { ...iv.consent, noChild: v } })}>
                  아이에게는 직접 묻거나 촬영하지 않아요 (보호자·교사만)
                </Check>
              </div>
            </Card>
            <Card className="mt-3">
              <Check
                checked={iv.consent.recording}
                onChange={(v) => update({ consent: { ...iv.consent, recording: v } })}
              >
                <b>녹음·자동 받아쓰기</b>에 동의받았어요 (선택)
              </Check>
              <p className="pl-9 text-[13px] text-ink-3">
                동의하지 않으면 녹음 버튼 없이 직접 적기만 할 수 있어요. 녹음 파일은 이 폰에만 저장돼요.
              </p>
            </Card>
            <Button className="mt-4 w-full" disabled={!consentOk} onClick={() => setStep(1)}>
              다음
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="지역">
              <Segmented value={iv.region} options={REGIONS} onChange={(v) => update({ region: v })} />
            </Field>
            <Field label="응답자">
              <Segmented value={iv.respondent} options={RESPONDENTS} onChange={(v) => update({ respondent: v })} size="sm" />
            </Field>
            <Field label="장소 (학교명 대신 '○○초 앞', '돌봄센터' 정도로)">
              <input
                className={inputClass}
                value={iv.place}
                onChange={(e) => update({ place: e.target.value })}
                placeholder="예: 초등학교 정문 앞"
              />
            </Field>
            <Field label="아이 학년대">
              <Segmented
                value={iv.gradeBand}
                options={[
                  { value: "low", label: "저학년(1~3)" },
                  { value: "high", label: "고학년(4~6)" },
                  { value: "unknown", label: "모름·해당없음" },
                ]}
                onChange={(v) => update({ gradeBand: v })}
                size="sm"
              />
            </Field>
            <Button className="w-full" onClick={() => setStep(2)}>
              질문 시작
            </Button>
          </div>
        )}

        {/* 녹음은 다른 단계로 넘어가도 계속 켜져 있도록 2단계 이후엔 계속 마운트 */}
        {iv.consent.recording && step >= 2 && (
          <Recorder
            showQuestions={step === 2}
            interviewId={iv.id}
            answers={iv.answers}
            onAnswers={(a) => update({ answers: a })}
            onClipSaved={() => update({ audioClips: ivRef.current.audioClips + 1 })}
            defaultLang={iv.region === "taiwan" ? "zh-TW" : "ko-KR"}
          />
        )}
        {!iv.consent.recording && step === 2 && (
          <ManualAnswers answers={iv.answers} onAnswers={(a) => update({ answers: a })} />
        )}

        {step === 3 && (
          <div>
            <Timeline slots={iv.slots} onChange={(s) => update({ slots: s })} />
            <Card className="mt-3 space-y-4">
              <Field label="학원을 '돌봄' 때문에 보내나요? (학원 역설 확인)">
                <Segmented
                  value={iv.privateForCare}
                  options={[
                    { value: "yes", label: "네" },
                    { value: "partly", label: "일부" },
                    { value: "no", label: "아니요" },
                  ]}
                  onChange={(v) => update({ privateForCare: v })}
                  size="sm"
                />
              </Field>
              <Field label="이웃에게 아이를 맡길 수 있나요?">
                <Segmented
                  value={iv.neighborTrust}
                  options={[
                    { value: "yes", label: "네" },
                    { value: "partly", label: "경우에 따라" },
                    { value: "no", label: "아니요" },
                  ]}
                  onChange={(v) => update({ neighborTrust: v })}
                  size="sm"
                />
              </Field>
              <Field label="돌봄·학원에 드는 한 달 비용 (대략)">
                <input
                  className={inputClass}
                  value={iv.monthlyCost}
                  onChange={(e) => update({ monthlyCost: e.target.value })}
                  placeholder="예: 학원 2곳 40만원"
                />
              </Field>
            </Card>
          </div>
        )}

        {step === 4 && (
          <div>
            <Card>
              <p className="text-[17px] font-bold">대상자에게 폰을 건네주세요</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
                &lsquo;이런 서비스가 있다면?&rsquo; 컨셉 {CONCEPTS.length}개를 넘겨 보며 반응을 고르게 해요. 우리
                메모·받아쓰기는 보이지 않아요. 방금 그린 하루가 첫 화면에 나와요.
              </p>
              <Button variant="accent" className="mt-3 w-full" onClick={() => setPreview(true)}>
                보여주기 시작
              </Button>
            </Card>
            <FeedbackSummary iv={iv} />
          </div>
        )}

        {step === 5 && (
          <Wrapup
            iv={iv}
            onNotes={(n) => update({ notes: n })}
            onAnalysis={(a) => update({ analysis: a })}
            onDelete={async () => {
              await deleteClips(iv.id).catch(() => {});
              deleteInterview(iv.id);
              onClose();
            }}
          />
        )}

        {step > 0 && step < 5 && (
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(step - 1)}>
              이전
            </Button>
            <Button className="flex-[2]" onClick={() => setStep(step + 1)}>
              다음 · {STEPS[step + 1]}
            </Button>
          </div>
        )}
        {iv.consent.recording && step >= 2 && <div className="h-24" />}
      </div>

      {preview && (
        <ServicePreview
          slots={iv.slots}
          feedback={iv.feedback}
          onFeedback={(f) => update({ feedback: f })}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
}

function ManualAnswers({ answers, onAnswers }: { answers: string[]; onAnswers: (a: string[]) => void }) {
  const qs = [...CORE_QUESTIONS, OTHER_QUESTION_LABEL];
  return (
    <div className="space-y-2">
      <p className="px-1 text-[13px] text-ink-3">녹음 동의가 없어서 직접 적는 모드예요.</p>
      {qs.map((q, i) => (
        <Card key={i} className="p-3">
          <p className="text-[15px] font-semibold leading-snug">
            {i < CORE_QUESTIONS.length ? `Q${i + 1}. ` : ""}
            {q}
          </p>
          <textarea
            value={answers[i] ?? ""}
            onChange={(e) => {
              const next = [...answers];
              next[i] = e.target.value;
              onAnswers(next);
            }}
            rows={3}
            className="mt-2 w-full resize-none rounded-chip bg-surface-2 p-2.5 text-[15px] outline-none"
          />
        </Card>
      ))}
    </div>
  );
}

function FeedbackSummary({ iv }: { iv: Interview }) {
  const label = { want: "🙆 쓰고 싶어요", maybe: "🤔 글쎄요", no: "🙅 필요 없어요" } as const;
  return (
    <Card className="mt-3">
      <p className="text-[15px] font-semibold">받은 반응</p>
      <div className="mt-2 divide-y divide-line">
        {CONCEPTS.map((c) => {
          const f = iv.feedback[c.id];
          return (
            <div key={c.id} className="py-2">
              <div className="flex justify-between gap-2 text-[14px]">
                <span className="font-medium">{c.title}</span>
                <span className="shrink-0 text-ink-2">{f?.reaction ? label[f.reaction] : "—"}</span>
              </div>
              {f?.comment && <p className="mt-0.5 text-[13px] text-ink-3">&ldquo;{f.comment}&rdquo;</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Wrapup({
  iv,
  onNotes,
  onAnalysis,
  onDelete,
}: {
  iv: Interview;
  onNotes: (n: string) => void;
  onAnalysis: (a: Analysis) => void;
  onDelete: () => void;
}) {
  const [clips, setClips] = useState<(Clip & { url: string })[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let urls: string[] = [];
    listClips(iv.id)
      .then((cs) => {
        const withUrl = cs.map((c) => ({ ...c, url: URL.createObjectURL(c.blob) }));
        urls = withUrl.map((c) => c.url);
        setClips(withUrl);
      })
      .catch(() => {});
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [iv.id, iv.audioClips]);

  // AI 없이 이 폰에서 바로 정리한다 (인터넷·비용 없음). 말은 바꾸지 않고 원문 문장을 골라 옮긴다
  const analyze = () => onAnalysis(summarizeInterview(iv));

  const a = iv.analysis;
  return (
    <div>
      <Field label="면접자 메모 (분위기, 관찰한 것, 받아쓰기에 안 들어간 말)">
        <textarea
          className={`${inputClass} min-h-[110px]`}
          value={iv.notes}
          onChange={(e) => onNotes(e.target.value)}
        />
      </Field>

      <Button variant="accent" className="mt-3 w-full" onClick={analyze}>
        {a ? "요약 다시 만들기" : "자동 요약 만들기"}
      </Button>
      <p className="mt-1.5 px-1 text-[12px] text-ink-3">
        이 폰에서 바로 정리해요 (인터넷·비용 없음, 밖으로 보내지 않음). 하루 그리기·선택한 답은 그대로, 받아쓰기는
        문장을 골라 원문 그대로 옮겨요. 해석은 팀이 직접.
      </p>

      {a && <AnalysisView a={a} />}

      {clips.length > 0 && (
        <Card className="mt-4">
          <p className="text-[15px] font-semibold">녹음 파일 {clips.length}개</p>
          <div className="mt-2 space-y-2">
            {clips.map((c, i) => (
              <div key={c.key}>
                <audio controls src={c.url} className="w-full" />
                <a
                  href={c.url}
                  download={`interview-${iv.id.slice(0, 8)}-${i + 1}.${c.blob.type.includes("mp4") ? "m4a" : "webm"}`}
                  className="text-[13px] font-semibold text-accent"
                >
                  파일로 저장
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-8">
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
            <Button variant="danger" className="flex-1" onClick={onDelete}>
              정말 삭제
            </Button>
          </div>
        ) : (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
            이 인터뷰 삭제 (녹음 포함)
          </Button>
        )}
      </div>
    </div>
  );
}

function AnalysisView({ a }: { a: Analysis }) {
  const trust = { yes: "맡길 수 있음", partly: "경우에 따라", no: "맡기기 어려움", unknown: "언급 없음" };
  return (
    <div className="mt-4 space-y-3">
      {a.perQuestion.map((p, i) => (
        <Card key={i} className="p-3">
          <p className="text-[13px] font-semibold text-ink-3">{p.question}</p>
          <p className="mt-1 text-[15px] leading-relaxed">{p.summary}</p>
        </Card>
      ))}
      <Card className="space-y-3 p-3">
        <Row title="공백 시간대" items={a.gapTimes} />
        <Row title="돌봄 수단" items={a.careMeans.map((c) => `${c.kind} — ${c.detail}${c.cost ? ` (${c.cost})` : ""}`)} />
        <Row title="위험 장소" items={a.riskPlaces.map((r) => `${r.place} — ${r.reason}`)} />
        <Row title="이웃에게 맡기기" items={[`${trust[a.neighborTrust.canEntrust]} — ${a.neighborTrust.reason}`]} />
        <Row title="제도가 있어도 남는 문제" items={a.remainingProblems} />
      </Card>
      {a.quotes.length > 0 && (
        <Card className="p-3">
          <p className="text-[13px] font-semibold text-ink-3">원문 인용 (받아쓰기 그대로)</p>
          {a.quotes.map((q, i) => (
            <p key={i} className="mt-1.5 border-l-4 border-accent pl-2.5 text-[15px]">
              {q}
            </p>
          ))}
        </Card>
      )}
      <div className="flex flex-wrap gap-1.5">
        {a.tags.map((t) => (
          <span key={t} className="rounded-full bg-card px-2.5 py-1 text-[13px] text-ink-2">
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Row({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[13px] font-semibold text-ink-3">{title}</p>
      <ul className="mt-0.5 space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="text-[15px] leading-snug">
            · {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
