import type { Task, Staff } from "@prisma/client";
import { db } from "@/lib/db";
import { inputDate } from "@/lib/format";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";
import type { CurrentUser } from "@/lib/auth";
import { assignableStaff, canAttachFollowUp, followUpStaff, getTaskScope } from "@/lib/task-access";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field } from "@/components/ui";

type Person = Pick<Staff, "id" | "firstName" | "lastName">;

function PeoplePicker({ name, people, checked }: { name: string; people: Person[]; checked: Set<number> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((s) => (
        <label key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-blue-50">
          <input type="checkbox" name={name} value={s.id} defaultChecked={checked.has(s.id)} /> {s.firstName} {s.lastName}
        </label>
      ))}
    </div>
  );
}

export async function TaskForm({
  user,
  action,
  task,
  defaults,
}: {
  user: CurrentUser;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  task?: Task & { assignees: Person[]; watchers: Person[] };
  defaults?: { projectId?: number; assigneeId?: number };
}) {
  const scope = await getTaskScope(user);
  const t = task;
  const [projects, customers, assignable, followUps] = await Promise.all([
    db.project.findMany({ where: { status: { notIn: ["CANCELLED", "FINISHED"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.customer.findMany({ where: { active: true }, orderBy: { company: "asc" }, select: { id: true, company: true } }),
    assignableStaff(user),
    canAttachFollowUp(scope) ? followUpStaff() : [],
  ]);
  // Keep people already on the task visible even if they're outside this user's team.
  const withExisting = (list: Person[], existing: Person[] = []) => [...list, ...existing.filter((e) => !list.some((p) => p.id === e.id))];
  const staff = withExisting(assignable, t?.assignees);
  const watchers = withExisting(followUps, canAttachFollowUp(scope) ? t?.watchers : []);
  const assigned = new Set(t ? t.assignees.map((a) => a.id) : defaults?.assigneeId ? [defaults.assigneeId] : []);
  const watching = new Set(t?.watchers.map((w) => w.id) ?? []);
  return (
    <ActionForm action={action}>
      <Card>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Task name *" className="sm:col-span-2"><input name="name" required defaultValue={t?.name} className="input" /></Field>
          <Field label="Project">
            <select name="projectId" defaultValue={t?.projectId ?? defaults?.projectId ?? ""} className="input">
              <option value="">— No project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Customer" hint="Auto-filled from the project if left empty">
            <select name="customerId" defaultValue={t?.customerId ?? ""} className="input">
              <option value="">—</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue={t?.priority ?? "MEDIUM"} className="input">
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={t?.status ?? "NOT_STARTED"} className="input">
              {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Start date"><input name="startDate" type="date" defaultValue={inputDate(t?.startDate ?? new Date())} className="input" /></Field>
          <Field label="Due date"><input name="dueDate" type="date" defaultValue={inputDate(t?.dueDate)} className="input" /></Field>
          <Field label="Description" className="sm:col-span-2"><textarea name="description" rows={5} defaultValue={t?.description ?? ""} className="input" /></Field>
          <div className="sm:col-span-2">
            <span className="label">Assignees</span>
            {scope.kind === "self" ? (
              <p className="text-sm text-slate-500">This task is assigned to you.</p>
            ) : (
              <PeoplePicker name="assignees" people={staff} checked={assigned} />
            )}
            {scope.kind === "team" && <p className="mt-1 text-xs text-slate-400">You can assign tasks to yourself and the Executives in your team.</p>}
          </div>
          {watchers.length > 0 && (
            <div className="sm:col-span-2">
              <span className="label">Follow-up (Super Admin / HR)</span>
              <PeoplePicker name="watchers" people={watchers} checked={watching} />
              <p className="mt-1 text-xs text-slate-400">They can see and comment on this task to track it. It isn&apos;t assigned to them.</p>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="billable" defaultChecked={t?.billable} /> Billable</label>
        </div>
        <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>{t ? "Save task" : "Create task"}</SubmitButton></div>
      </Card>
    </ActionForm>
  );
}
