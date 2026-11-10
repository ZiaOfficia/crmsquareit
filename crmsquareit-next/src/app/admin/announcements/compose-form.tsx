"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Building2, Globe, Search, UserRound } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/client";
import type { ActionState } from "@/lib/forms";

export type DeptOption = { id: number; name: string; children: { id: number; name: string }[] };
export type StaffOption = { id: number; name: string; sub: string };
export type ComposeValues = {
  title: string;
  message: string;
  audience: "ALL" | "DEPARTMENTS" | "PEOPLE";
  departmentIds: number[];
  staffIds: number[];
  urgent: boolean;
  pinned: boolean;
  expiresAt: string;
};

const EMPTY: ComposeValues = { title: "", message: "", audience: "ALL", departmentIds: [], staffIds: [], urgent: false, pinned: false, expiresAt: "" };

const AUDIENCE_TABS = [
  { key: "ALL", label: "Everyone", icon: Globe },
  { key: "DEPARTMENTS", label: "Departments", icon: Building2 },
  { key: "PEOPLE", label: "Specific people", icon: UserRound },
] as const;

export function ComposeForm({
  action,
  departments,
  staff,
  initial,
  submitLabel = "Send announcement",
  compact,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  departments: DeptOption[];
  staff: StaffOption[];
  initial?: Partial<ComposeValues>;
  submitLabel?: string;
  compact?: boolean;
}) {
  const start = { ...EMPTY, ...initial };
  const [audience, setAudience] = useState(start.audience);
  const [depts, setDepts] = useState<Set<number>>(new Set(start.departmentIds));
  const [people, setPeople] = useState<Set<number>>(new Set(start.staffIds));
  const [q, setQ] = useState("");
  const isEdit = !!initial?.title;

  const toggle = (set: Set<number>, update: (s: Set<number>) => void, id: number) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    update(next);
  };
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? staff.filter((s) => `${s.name} ${s.sub}`.toLowerCase().includes(t)) : staff;
  }, [q, staff]);

  return (
    <ActionForm action={action} resetOnSuccess={!isEdit} savedText={isEdit ? undefined : "Announcement sent."} className="space-y-4">
      <input type="hidden" name="audience" value={audience} />
      {audience === "DEPARTMENTS" && [...depts].map((id) => <input key={id} type="hidden" name="departmentIds" value={id} />)}
      {audience === "PEOPLE" && [...people].map((id) => <input key={id} type="hidden" name="staffIds" value={id} />)}

      <div>
        <span className="label">Send to</span>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          {AUDIENCE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setAudience(t.key)}
              className={clsx(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition sm:text-sm",
                audience === t.key ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {audience === "DEPARTMENTS" && (
        <div className="flex flex-wrap gap-2">
          {departments.flatMap((d) => [d, ...d.children.map((c) => ({ ...c, children: [], parent: d.name }))]).map((d) => {
            const on = depts.has(d.id);
            const parent = "parent" in d ? (d.parent as string) : null;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggle(depts, setDepts, d.id)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  on ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-600 hover:border-primary hover:text-primary"
                )}
                title={d.children.length ? `Includes ${d.children.map((c) => c.name).join(" and ")}` : undefined}
              >
                {parent ? `${parent} › ` : ""}
                {d.name}
                {d.children.length > 0 && " (all)"}
              </button>
            );
          })}
        </div>
      )}

      {audience === "PEOPLE" && (
        <div className="rounded-lg border border-slate-200">
          <div className="relative border-b border-slate-100">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${staff.length} people…`} className="w-full rounded-t-lg py-2 pl-9 pr-3 text-sm outline-none" />
          </div>
          <ul className={clsx("divide-y divide-slate-50 overflow-y-auto", compact ? "max-h-40" : "max-h-56")}>
            {filtered.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                  <input type="checkbox" checked={people.has(s.id)} onChange={() => toggle(people, setPeople, s.id)} className="h-4 w-4 rounded accent-[#3f63b5]" />
                  <span className="text-sm text-slate-800">{s.name}</span>
                  <span className="ml-auto truncate text-xs text-slate-400">{s.sub}</span>
                </label>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-400">No one matches “{q}”.</li>}
          </ul>
          {people.size > 0 && <p className="border-t border-slate-100 px-3 py-1.5 text-xs font-medium text-primary">{people.size} selected</p>}
        </div>
      )}

      <input name="title" defaultValue={start.title} placeholder="Title" maxLength={160} className="input font-medium" />
      <textarea name="message" defaultValue={start.message} placeholder="Write your announcement…" rows={compact ? 3 : 5} className="input" />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="urgent" defaultChecked={start.urgent} className="h-4 w-4 rounded accent-[#e84a37]" /> Urgent
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="pinned" defaultChecked={start.pinned} className="h-4 w-4 rounded accent-[#3f63b5]" /> Pin to top
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Expires
          <input type="date" name="expiresAt" defaultValue={start.expiresAt} className="input w-auto py-1" />
        </label>
        <SubmitButton className="ml-auto">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
