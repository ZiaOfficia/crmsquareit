import type { Expense } from "@prisma/client";
import { db } from "@/lib/db";
import { inputDate } from "@/lib/format";
import type { ActionState } from "@/lib/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field } from "@/components/ui";

export async function ExpenseForm({ action, expense }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; expense?: Expense }) {
  const [cats, customers, projects, modes, taxes] = await Promise.all([
    db.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    db.customer.findMany({ where: { active: true }, orderBy: { company: "asc" }, select: { id: true, company: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.paymentMode.findMany({ where: { active: true } }),
    db.tax.findMany(),
  ]);
  const e = expense;
  return (
    <ActionForm action={action}>
      <Card>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Expense name *" className="sm:col-span-2"><input name="name" required defaultValue={e?.name} className="input" /></Field>
          <Field label="Category *">
            <select name="categoryId" required defaultValue={e?.categoryId} className="input">
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input name="date" type="date" defaultValue={inputDate(e?.date ?? new Date())} className="input" /></Field>
          <Field label="Amount *"><input name="amount" type="number" step="0.01" min="0" required defaultValue={e?.amount} className="input" /></Field>
          <Field label="Tax">
            <select name="taxRate" defaultValue={e?.taxRate ?? 0} className="input">
              <option value={0}>No tax</option>
              {taxes.map((t) => <option key={t.id} value={t.rate}>{t.name} {t.rate}%</option>)}
            </select>
          </Field>
          <Field label="Customer">
            <select name="customerId" defaultValue={e?.customerId ?? ""} className="input">
              <option value="">—</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </Field>
          <Field label="Project">
            <select name="projectId" defaultValue={e?.projectId ?? ""} className="input">
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Payment mode">
            <select name="paymentMode" defaultValue={e?.paymentMode ?? ""} className="input">
              <option value="">—</option>
              {modes.map((m) => <option key={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Reference #"><input name="reference" defaultValue={e?.reference ?? ""} className="input" /></Field>
          <Field label="Note" className="sm:col-span-2"><textarea name="note" rows={3} defaultValue={e?.note ?? ""} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="billable" defaultChecked={e?.billable} /> Billable to customer</label>
        </div>
        <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>{e ? "Save expense" : "Record expense"}</SubmitButton></div>
      </Card>
    </ActionForm>
  );
}
