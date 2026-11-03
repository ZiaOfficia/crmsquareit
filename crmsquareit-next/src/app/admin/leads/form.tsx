import type { Lead, LeadSource, LeadStatus, Staff } from "@prisma/client";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field } from "@/components/ui";
import type { ActionState } from "@/lib/forms";

export function LeadForm({
  action,
  lead,
  statuses,
  sources,
  staff,
  currentUserId,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  lead?: Lead;
  statuses: LeadStatus[];
  sources: LeadSource[];
  staff: Pick<Staff, "id" | "firstName" | "lastName">[];
  currentUserId: number;
}) {
  const l = lead;
  return (
    <ActionForm action={action} className="space-y-6">
      <Card title="Lead">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Status">
            <select name="statusId" defaultValue={l?.statusId ?? statuses.find((s) => s.isDefault)?.id} className="input">
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select name="sourceId" defaultValue={l?.sourceId ?? ""} className="input">
              <option value="">—</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Assigned to">
            <select name="assignedId" defaultValue={l?.assignedId ?? currentUserId} className="input">
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </Field>
          <Field label="Name *"><input name="name" required defaultValue={l?.name} className="input" /></Field>
          <Field label="Position"><input name="title" defaultValue={l?.title ?? ""} className="input" /></Field>
          <Field label="Company"><input name="company" defaultValue={l?.company ?? ""} className="input" /></Field>
          <Field label="Email"><input name="email" type="email" defaultValue={l?.email ?? ""} className="input" /></Field>
          <Field label="Phone"><input name="phone" defaultValue={l?.phone ?? ""} className="input" /></Field>
          <Field label="Website"><input name="website" defaultValue={l?.website ?? ""} className="input" /></Field>
          <Field label="Lead value"><input name="value" type="number" step="0.01" min="0" defaultValue={l?.value ?? ""} className="input" /></Field>
          <Field label="City"><input name="city" defaultValue={l?.city ?? ""} className="input" /></Field>
          <Field label="Country"><input name="country" defaultValue={l?.country ?? "India"} className="input" /></Field>
          <Field label="Address" className="sm:col-span-3"><input name="address" defaultValue={l?.address ?? ""} className="input" /></Field>
          <Field label="Description" className="sm:col-span-3"><textarea name="description" rows={4} defaultValue={l?.description ?? ""} className="input" /></Field>
        </div>
      </Card>
      <div className="flex justify-end"><SubmitButton>{l ? "Save changes" : "Create lead"}</SubmitButton></div>
    </ActionForm>
  );
}
