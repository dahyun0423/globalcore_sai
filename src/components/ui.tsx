"use client";

import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-card p-4 shadow-card ${className}`}>{children}</div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-end justify-between px-1">
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-3">{children}</h2>
      {right}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex rounded-chip bg-grey-100 p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[8px] px-2 font-semibold transition ${
            size === "sm" ? "py-1 text-[13px]" : "py-2 text-[15px]"
          } ${value === o.value ? "bg-card text-accent shadow-card" : "text-ink-2"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[14px] font-semibold transition ${
        active ? "border-transparent text-white" : "border-line bg-card text-ink-2"
      }`}
      style={active ? { background: color ?? "var(--accent)" } : undefined}
    >
      {children}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "accent";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    /* 주 동작 — 파랑 */
    accent: "bg-accent text-white",
    /* 강조하되 주 동작은 아닌 것 — 먹색 */
    primary: "bg-ink text-white",
    secondary: "border border-line-strong bg-card text-ink",
    danger: "border border-danger-line bg-card text-danger",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[48px] rounded-field px-4 text-[16px] font-bold transition active:scale-[0.98] disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-chip border border-line bg-card px-3.5 py-3 text-[16px] outline-none transition focus:border-accent";

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 py-2.5 text-left"
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
          checked ? "border-accent bg-accent text-white" : "border-grey-300"
        }`}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 8.5l3.2 3L13 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-[15px] leading-snug text-ink keep-all">{children}</span>
    </button>
  );
}

/** 지도 위 아래쪽에서 올라오는 시트 */
export function Sheet({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[600] max-h-[78%] overflow-y-auto rounded-t-[24px] bg-card px-4 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
      style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
    >
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-grey-300" />
      {children}
    </div>
  );
}
