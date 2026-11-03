import type { Staff } from "@prisma/client";
import { db } from "@/lib/db";
import type { ActionState } from "@/lib/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field } from "@/components/ui";

export async function StaffForm({ action, staff, canSetAdmin }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; staff?: Staff; canSetAdmin: boolean }) {
  const roles = await db.role.findMany({ orderBy: { name: "asc" } });
  const s = staff;
  return (
    <ActionForm action={action}>
      <Card>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="First name *"><input name="firstName" required defaultValue={s?.firstName} className="input" /></Field>
          <Field label="Last name"><input name="lastName" defaultValue={s?.lastName} className="input" /></Field>
          <Field label="Email *"><input name="email" type="email" required defaultValue={s?.email} className="input" /></Field>
          <Field label="Phone"><input name="phone" defaultValue={s?.phone ?? ""} className="input" /></Field>
          <Field label="Role">
            <select name="roleId" defaultValue={s?.roleId ?? ""} className="input">
              <option value="">— No role —</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label={s ? "New password" : "Password *"} hint={s ? "Leave blank to keep the current password" : "At least 6 characters"}>
            <input name="password" type="password" autoComplete="new-password" className="input" />
          </Field>
          <div className="flex flex-wrap gap-6 sm:col-span-2">
            {canSetAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isAdmin" defaultChecked={s?.isAdmin} /> Administrator (full access)</label>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={s?.active ?? true} /> Active</label>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>{s ? "Save" : "Add staff member"}</SubmitButton></div>
      </Card>
    </ActionForm>
  );
}
