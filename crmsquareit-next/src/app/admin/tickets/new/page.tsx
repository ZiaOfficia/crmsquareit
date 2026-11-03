import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { PRIORITY } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field, PageHeader } from "@/components/ui";
import { createTicket } from "../actions";

export const metadata = { title: "Open ticket" };

export default async function NewTicket() {
  const user = await requirePerm("tickets", "create");
  const [customers, depts, staff, projects] = await Promise.all([
    db.customer.findMany({ where: { active: true }, orderBy: { company: "asc" }, include: { contacts: true } }),
    db.department.findMany(),
    db.staff.findMany({ where: { active: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Open support ticket" back={{ href: "/admin/tickets", label: "Support" }} />
      <ActionForm action={createTicket}>
        <Card>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Subject *" className="sm:col-span-2"><input name="subject" required className="input" /></Field>
            <Field label="Contact">
              <select name="contactId" className="input">
                <option value="">— Not a saved contact —</option>
                {customers.map((c) => (
                  <optgroup key={c.id} label={c.company}>
                    {c.contacts.map((ct) => <option key={ct.id} value={ct.id}>{ct.firstName} {ct.lastName} ({ct.email})</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Customer">
              <select name="customerId" className="input">
                <option value="">— From contact —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </Field>
            <Field label="Name (if not a contact)"><input name="name" className="input" /></Field>
            <Field label="Email (if not a contact)"><input name="email" type="email" className="input" /></Field>
            <Field label="Department">
              <select name="departmentId" className="input">{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            </Field>
            <Field label="Priority">
              <select name="priority" defaultValue="MEDIUM" className="input">{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            </Field>
            <Field label="Assign to">
              <select name="assignedId" defaultValue={user.id} className="input">
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
              </select>
            </Field>
            <Field label="Project">
              <select name="projectId" className="input"><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </Field>
            <Field label="Message *" className="sm:col-span-2"><textarea name="message" rows={7} required className="input" /></Field>
          </div>
          <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>Open ticket</SubmitButton></div>
        </Card>
      </ActionForm>
    </div>
  );
}
