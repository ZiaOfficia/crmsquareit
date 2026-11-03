import type { Project, Staff } from "@prisma/client";
import { db } from "@/lib/db";
import { inputDate } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field } from "@/components/ui";

export async function ProjectForm({
  action,
  project,
  defaultCustomerId,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  project?: Project & { members: Staff[] };
  defaultCustomerId?: number;
}) {
  const [customers, staff] = await Promise.all([
    db.customer.findMany({ where: { active: true }, orderBy: { company: "asc" }, select: { id: true, company: true } }),
    db.staff.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
  ]);
  const p = project;
  const memberIds = new Set(p?.members.map((m) => m.id));
  return (
    <ActionForm action={action}>
      <Card>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Project name *" className="sm:col-span-2"><input name="name" required defaultValue={p?.name} className="input" /></Field>
          <Field label="Customer *">
            <select name="customerId" required defaultValue={p?.customerId ?? defaultCustomerId ?? ""} className="input">
              <option value="">Select…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={p?.status ?? "NOT_STARTED"} className="input">
              {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Billing type">
            <select name="billingType" defaultValue={p?.billingType ?? "FIXED"} className="input">
              <option value="FIXED">Fixed price</option>
              <option value="HOURLY">Hourly rate</option>
            </select>
          </Field>
          <Field label="Total price / hourly rate"><input name="rate" type="number" step="0.01" min="0" defaultValue={p?.rate ?? ""} className="input" /></Field>
          <Field label="Start date"><input name="startDate" type="date" required defaultValue={inputDate(p?.startDate ?? new Date())} className="input" /></Field>
          <Field label="Deadline"><input name="deadline" type="date" defaultValue={inputDate(p?.deadline)} className="input" /></Field>
          <Field label={`Progress (%)`}><input name="progress" type="number" min="0" max="100" defaultValue={p?.progress ?? 0} className="input" /></Field>
          <Field label="Description" className="sm:col-span-2"><textarea name="description" rows={4} defaultValue={p?.description ?? ""} className="input" /></Field>
          <div className="sm:col-span-2">
            <span className="label">Members</span>
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-blue-50">
                  <input type="checkbox" name="members" value={s.id} defaultChecked={memberIds.has(s.id)} /> {s.firstName} {s.lastName}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>{p ? "Save project" : "Create project"}</SubmitButton></div>
      </Card>
    </ActionForm>
  );
}
