import Link from "next/link";
import type { DepartmentMember, Staff } from "@prisma/client";
import { db } from "@/lib/db";
import { TEAM_ROLES } from "@/lib/org";
import { assignableDepartments } from "@/lib/org-server";
import type { ActionState } from "@/lib/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field } from "@/components/ui";

/** canSetAdmin: Super Admin only. canSetOrg: Super Admin and HR (department + team role). */
export async function StaffForm({ action, staff, canSetAdmin, canSetOrg = canSetAdmin }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; staff?: Staff & { orgMemberships?: DepartmentMember[] }; canSetAdmin: boolean; canSetOrg?: boolean }) {
  const [roles, departments] = await Promise.all([db.role.findMany({ orderBy: { name: "asc" } }), canSetOrg ? assignableDepartments() : []]);
  const s = staff;
  const memberships = s?.orgMemberships ?? [];
  // The form edits a single assignment. If someone has several (allowed by the
  // schema for later), they're managed on the Departments page instead.
  const editOrg = canSetOrg && memberships.length <= 1;
  const current = memberships[0];
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
          {editOrg && (
            <>
              <input type="hidden" name="orgField" value="1" />
              <Field label="Department" hint="Super Admins aren't limited by department">
                <select name="orgDepartmentId" defaultValue={current?.departmentId ?? ""} className="input">
                  <option value="">— Not in a department —</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </Field>
              <Field label="Team role">
                <select name="teamRole" defaultValue={current?.teamRole ?? "EXECUTIVE"} className="input">
                  {TEAM_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </Field>
            </>
          )}
          {canSetOrg && !editOrg && (
            <p className="text-sm text-slate-500 sm:col-span-2">
              In {memberships.length} departments. Manage them on the <Link href="/admin/staff?view=departments" className="link">Departments</Link> page.
            </p>
          )}
          <div className="flex flex-wrap gap-6 sm:col-span-2">
            {canSetAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isAdmin" defaultChecked={s?.isAdmin} /> Super Admin (full access to everything)</label>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={s?.active ?? true} /> Active</label>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>{s ? "Save" : "Add staff member"}</SubmitButton></div>
      </Card>
    </ActionForm>
  );
}
