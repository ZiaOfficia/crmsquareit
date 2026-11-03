"use client";
import { useState } from "react";
import type { Contact } from "@prisma/client";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/client";
import { Badge, Card, Field, btn } from "@/components/ui";
import type { ActionState } from "@/lib/forms";

export function Contacts({
  contacts,
  save,
  remove,
  canEdit,
}: {
  contacts: Contact[];
  save: (s: ActionState, f: FormData) => Promise<ActionState>;
  remove: (f: FormData) => Promise<void>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);
  return (
    <Card title={`Contacts (${contacts.length})`} actions={canEdit && <button className={btn("secondary", "py-1.5 text-xs")} onClick={() => setEditing({})}>+ Add contact</button>}>
      {editing && (
        <ActionForm
          key={editing.id ?? "new"}
          action={async (s, f) => {
            const r = await save(s, f);
            if (r?.ok) setEditing(null);
            return r;
          }}
          className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-5 sm:grid-cols-3"
        >
          <input type="hidden" name="id" value={editing.id ?? ""} />
          <Field label="First name *"><input name="firstName" required defaultValue={editing.firstName} className="input" /></Field>
          <Field label="Last name"><input name="lastName" defaultValue={editing.lastName} className="input" /></Field>
          <Field label="Email *"><input name="email" type="email" required defaultValue={editing.email} className="input" /></Field>
          <Field label="Phone"><input name="phone" defaultValue={editing.phone ?? ""} className="input" /></Field>
          <Field label="Position"><input name="title" defaultValue={editing.title ?? ""} className="input" /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" name="isPrimary" defaultChecked={editing.isPrimary} /> Primary contact
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <SubmitButton>Save contact</SubmitButton>
            <button type="button" className={btn("ghost")} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </ActionForm>
      )}
      {contacts.length === 0 && !editing ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">No contacts yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">
                  {c.firstName} {c.lastName} {c.isPrimary && <Badge tone="blue">Primary</Badge>}
                </p>
                <p className="text-xs text-slate-500">
                  {[c.title, c.email, c.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button className={btn("ghost", "px-2 py-1 text-xs")} onClick={() => setEditing(c)}>Edit</button>
                  <ConfirmButton action={remove} hidden={{ id: c.id }} label="Delete" variant="ghost" className="px-2 py-1 text-xs" confirmLabel="Confirm" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
