import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/constants";

export { clsx as cx };

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const btnVariants = {
  primary: "bg-primary text-white shadow-sm hover:bg-primary-dark",
  secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-brand-red text-white hover:bg-red-600",
  success: "bg-brand-green text-white hover:bg-green-700",
};
export type BtnVariant = keyof typeof btnVariants;
export const btn = (v: BtnVariant = "primary", extra?: string) => clsx(btnBase, btnVariants[v], extra);

export function ButtonLink({ href, variant = "primary", children, className }: { href: string; variant?: BtnVariant; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={btn(variant, className)}>
      {children}
    </Link>
  );
}

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={clsx("card", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

const tones: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-green-50 text-green-700 ring-green-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
};

export function Badge({ tone = "gray", children, color }: { tone?: Tone; children: ReactNode; color?: string }) {
  if (color)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset" style={{ color, backgroundColor: color + "14", borderColor: color, ["--tw-ring-color" as string]: color + "55" }}>
        {children}
      </span>
    );
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone])}>{children}</span>;
}

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: Tone }>; value: string }) {
  const s = map[value] ?? { label: value, tone: "gray" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-xs font-medium text-slate-500 hover:text-primary">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 grid h-12 w-12 grid-cols-2 gap-1 opacity-60">
        <span className="rounded-sm bg-brand-green" />
        <span className="rounded-sm bg-brand-red" />
        <span className="rounded-sm bg-brand-blue" />
        <span className="rounded-sm bg-brand-yellow" />
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50/70">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Stat({ label, value, sub, accent = "blue", href }: { label: string; value: ReactNode; sub?: ReactNode; accent?: "blue" | "green" | "red" | "yellow"; href?: string }) {
  const bar = { blue: "bg-brand-blue", green: "bg-brand-green", red: "bg-brand-red", yellow: "bg-brand-yellow" }[accent];
  const inner = (
    <div className="card relative overflow-hidden p-5 transition hover:shadow-md">
      <span className={clsx("absolute inset-y-0 left-0 w-1", bar)} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const colors = ["#27ae57", "#e84a37", "#4f74c4", "#e0a400", "#7c5cc4", "#0f9fb0"];
  const idx = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % colors.length;
  const ini = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span title={name} className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white" style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: colors[idx] }}>
      {ini}
    </span>
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children ?? "—"}</dd>
    </div>
  );
}

export function Tabs({ tabs, active, base }: { tabs: { key: string; label: string; count?: number }[]; active: string; base: string }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${base}${base.includes("?") ? "&" : "?"}tab=${t.key}`}
          className={clsx(
            "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition",
            active === t.key ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}
