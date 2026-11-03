"use client";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { btn, type BtnVariant } from "./ui";
import type { ActionState } from "@/lib/forms";

export function SubmitButton({ children, variant = "primary", className }: { children: ReactNode; variant?: BtnVariant; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btn(variant, className)}>
      {pending ? "Saving…" : children}
    </button>
  );
}

/** Form wired to a server action that returns ActionState (or redirects). Shows error inline. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  savedText,
}: {
  action: (state: ActionState, f: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  savedText?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{state.error}</div>}
      {state?.ok && savedText && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">{savedText}</div>}
      {children}
    </form>
  );
}

/** Two-step confirm button that submits a server action (no browser dialogs). */
export function ConfirmButton({
  action,
  label = "Delete",
  confirmLabel = "Click to confirm",
  variant = "secondary",
  hidden,
  className,
}: {
  action: (f: FormData) => Promise<void>;
  label?: ReactNode;
  confirmLabel?: string;
  variant?: BtnVariant;
  hidden?: Record<string, string | number>;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <form action={action} className="inline">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {armed ? (
        <button type="submit" className={btn("danger", className)}>
          {confirmLabel}
        </button>
      ) : (
        <button type="button" onClick={() => setArmed(true)} className={btn(variant, className)}>
          {label}
        </button>
      )}
    </form>
  );
}

/** Select that navigates by updating a search param (for filters). */
export function FilterSelect({ name, options, placeholder }: { name: string; options: { value: string; label: string }[]; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <select
      className="input w-auto min-w-40"
      value={sp.get(name) ?? ""}
      onChange={(e) => {
        const p = new URLSearchParams(sp.toString());
        if (e.target.value) p.set(name, e.target.value);
        else p.delete(name);
        p.delete("page");
        router.push(`${pathname}?${p.toString()}`);
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SearchBox({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const p = new URLSearchParams(sp.toString());
        if (q) p.set("q", q);
        else p.delete("q");
        p.delete("page");
        router.push(`${pathname}?${p.toString()}`);
      }}
      className="relative"
    >
      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="input w-64 pl-9" />
    </form>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={btn("secondary")}>
      Print / PDF
    </button>
  );
}

export function CopyLink({ path, label = "Copy client link" }: { path: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btn("secondary")}
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.origin + path);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied!" : label}
    </button>
  );
}
