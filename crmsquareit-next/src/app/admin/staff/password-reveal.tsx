"use client";
import { useState, useTransition } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { revealStaffPassword } from "./actions";

/** Masked password that's fetched from the server only when "Show" is clicked. */
export function PasswordReveal({ staffId }: { staffId: number }) {
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const toggle = () => {
    if (password) return setPassword(null);
    setError(null);
    start(async () => {
      const r = await revealStaffPassword(staffId);
      if (r.password) setPassword(r.password);
      else setError(r.error ?? "Couldn't load the password.");
    });
  };
  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <code className="min-w-40 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800">{password ?? "••••••••"}</code>
        <button type="button" onClick={toggle} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {password ? <EyeOff size={15} /> : <Eye size={15} />} {pending ? "Loading…" : password ? "Hide" : "Show"}
        </button>
        {password && (
          <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Copy size={15} /> {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-amber-700">{error}</p>}
    </div>
  );
}
