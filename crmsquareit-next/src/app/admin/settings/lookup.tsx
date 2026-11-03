"use client";
import { useState } from "react";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/client";
import { Card, btn } from "@/components/ui";
import type { ActionState } from "@/lib/forms";

export type Col = { key: string; label: string; type?: "text" | "number" | "color" | "checkbox" | "textarea"; width?: string };

export function LookupTable({
  title,
  table,
  cols,
  rows,
  save,
  remove,
  hint,
}: {
  title: string;
  table: string;
  cols: Col[];
  rows: Record<string, unknown>[];
  save: (s: ActionState, f: FormData) => Promise<ActionState>;
  remove: (f: FormData) => Promise<void>;
  hint?: string;
}) {
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const display = (r: Record<string, unknown>, c: Col) => {
    const v = r[c.key];
    if (c.type === "checkbox") return v ? "Yes" : "No";
    if (c.type === "color") return <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: String(v) }} />{String(v)}</span>;
    return v === null || v === undefined || v === "" ? "—" : String(v);
  };
  return (
    <Card title={title} actions={<button className={btn("secondary", "py-1.5 text-xs")} onClick={() => setEditing({})}>+ Add</button>}>
      {hint && <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">{hint}</p>}
      {editing && (
        <ActionForm
          key={String(editing.id ?? "new")}
          action={async (s, f) => {
            const r = await save(s, f);
            if (r?.ok) setEditing(null);
            return r;
          }}
          className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50/60 p-4"
        >
          <input type="hidden" name="id" value={String(editing.id ?? "")} />
          {cols.map((c) => (
            <label key={c.key} className={c.type === "checkbox" ? "flex items-center gap-2 pb-2 text-sm" : c.width ?? "min-w-40 flex-1"}>
              {c.type === "checkbox" ? (
                <><input type="checkbox" name={c.key} defaultChecked={editing.id ? Boolean(editing[c.key]) : true} /> {c.label}</>
              ) : (
                <>
                  <span className="label">{c.label}</span>
                  {c.type === "textarea" ? (
                    <textarea name={c.key} rows={1} defaultValue={String(editing[c.key] ?? "")} className="input" />
                  ) : (
                    <input name={c.key} type={c.type ?? "text"} step="any" defaultValue={String(editing[c.key] ?? (c.type === "color" ? "#4f74c4" : ""))} className={c.type === "color" ? "input h-10 p-1" : "input"} />
                  )}
                </>
              )}
            </label>
          ))}
          <SubmitButton>Save</SubmitButton>
          <button type="button" className={btn("ghost")} onClick={() => setEditing(null)}>Cancel</button>
        </ActionForm>
      )}
      <table className="min-w-full">
        <thead className="bg-slate-50/70"><tr>{cols.map((c) => <th key={c.key} className="th">{c.label}</th>)}<th className="th w-32" /></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={String(r.id)}>
              {cols.map((c) => <td key={c.key} className="td">{display(r, c)}</td>)}
              <td className="td text-right whitespace-nowrap">
                <button className={btn("ghost", "px-2 py-1 text-xs")} onClick={() => setEditing(r)}>Edit</button>
                <ConfirmButton action={remove} hidden={{ id: String(r.id), table }} label="Delete" confirmLabel="Confirm" variant="ghost" className="px-2 py-1 text-xs" />
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="px-5 py-6 text-center text-sm text-slate-400">Nothing here yet.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
