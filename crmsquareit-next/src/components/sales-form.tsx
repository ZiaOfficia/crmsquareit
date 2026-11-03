import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { inputDate } from "@/lib/format";
import { CURRENCIES } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";
import { ActionForm, SubmitButton } from "./client";
import { Card, Field } from "./ui";
import { LineItemsEditor, type EditorItem } from "./line-items";

export type SalesDocValues = {
  customerId?: number;
  projectId?: number | null;
  date?: Date;
  secondDate?: Date | null; // due date / expiry date
  currency?: string;
  discountPercent?: number;
  adjustment?: number;
  clientNote?: string | null;
  terms?: string | null;
  items?: EditorItem[];
  number?: string;
};

export async function SalesForm({
  kind,
  action,
  values,
  submitLabel,
}: {
  kind: "invoice" | "estimate";
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  values: SalesDocValues;
  submitLabel: string;
}) {
  const [customers, projects, items, taxes, settings] = await Promise.all([
    db.customer.findMany({ where: { active: true }, orderBy: { company: "asc" }, select: { id: true, company: true } }),
    db.project.findMany({ where: { status: { not: "CANCELLED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, customerId: true } }),
    db.item.findMany({ orderBy: { description: "asc" } }),
    db.tax.findMany({ orderBy: { rate: "desc" } }),
    getSettings(),
  ]);
  const currency = values.currency || settings.currency;
  return (
    <ActionForm action={action} className="space-y-6">
      <Card title={kind === "invoice" ? "Invoice details" : "Estimate details"} actions={values.number && <span className="text-sm font-semibold text-slate-500">{values.number}</span>}>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Customer *" className="sm:col-span-2">
            <select name="customerId" required defaultValue={values.customerId ?? ""} className="input">
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.company}</option>
              ))}
            </select>
          </Field>
          <Field label="Project">
            <select name="projectId" defaultValue={values.projectId ?? ""} className="input">
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={currency} className="input">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={kind === "invoice" ? "Invoice date" : "Estimate date"}>
            <input type="date" name="date" required defaultValue={inputDate(values.date ?? new Date())} className="input" />
          </Field>
          <Field label={kind === "invoice" ? "Due date" : "Expiry date"}>
            <input type="date" name="secondDate" defaultValue={inputDate(values.secondDate)} className="input" />
          </Field>
        </div>
      </Card>
      <Card title="Items">
        <LineItemsEditor
          initial={values.items ?? []}
          savedItems={items}
          taxRates={taxes.map((t) => ({ label: `${t.name} ${t.rate}%`, rate: t.rate }))}
          initialDiscount={values.discountPercent}
          initialAdjustment={values.adjustment}
          currency={currency}
        />
      </Card>
      <Card title="Notes & terms">
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Client note">
            <textarea name="clientNote" rows={4} defaultValue={values.clientNote ?? (kind === "invoice" ? settings.invoice_client_note : "")} className="input" />
          </Field>
          <Field label="Terms & conditions">
            <textarea name="terms" rows={4} defaultValue={values.terms ?? (kind === "invoice" ? settings.invoice_terms : settings.estimate_terms)} className="input" />
          </Field>
        </div>
      </Card>
      <div className="flex justify-end gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
