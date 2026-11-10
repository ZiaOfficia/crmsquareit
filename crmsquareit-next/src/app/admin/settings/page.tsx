import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { CURRENCIES } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field, PageHeader, Tabs } from "@/components/ui";
import { LookupTable } from "./lookup";
import { deleteLookup, saveLookup, updateSettings } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePerm("settings");
  const { tab = "company" } = await searchParams;
  const s = await getSettings();
  const input = (k: keyof typeof s, label: string, opts: { type?: string; span?: boolean; area?: boolean } = {}) => (
    <Field label={label} className={opts.span ? "sm:col-span-2" : undefined}>
      {opts.area ? <textarea name={k} rows={4} defaultValue={s[k]} className="input" /> : <input name={k} type={opts.type ?? "text"} defaultValue={s[k]} className="input" />}
    </Field>
  );

  return (
    <>
      <PageHeader title="Settings" />
      <Tabs
        base="/admin/settings"
        active={tab}
        tabs={[
          { key: "company", label: "Company" },
          { key: "finance", label: "Invoices & estimates" },
          { key: "items", label: "Items & taxes" },
          { key: "leads", label: "Leads" },
          { key: "lists", label: "Other lists" },
        ]}
      />

      {tab === "company" && (
        <ActionForm action={updateSettings} savedText="Settings saved." className="max-w-4xl">
          <Card title="Company information" actions={<SubmitButton>Save</SubmitButton>}>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {input("company_name", "Company name")}
              {input("company_tagline", "Tagline")}
              {input("company_email", "Email", { type: "email" })}
              {input("company_phone", "Phone")}
              {input("company_address", "Address", { span: true })}
              {input("company_city", "City")}
              {input("company_state", "State")}
              {input("company_zip", "ZIP / PIN")}
              {input("company_country", "Country")}
              {input("company_vat", "GSTIN / VAT number")}
            </div>
          </Card>
        </ActionForm>
      )}

      {tab === "finance" && (
        <ActionForm action={updateSettings} savedText="Settings saved." className="max-w-4xl space-y-6">
          <Card title="General" actions={<SubmitButton>Save</SubmitButton>}>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Default currency">
                <select name="currency" defaultValue={s.currency} className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
              </Field>
              {input("bank_details", "Bank / payment details (shown on invoices)", { span: true, area: true })}
            </div>
          </Card>
          <Card title="Invoices">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {input("invoice_prefix", "Number prefix")}
              {input("invoice_due_days", "Due after (days)", { type: "number" })}
              {input("invoice_client_note", "Default client note", { span: true, area: true })}
              {input("invoice_terms", "Default terms & conditions", { span: true, area: true })}
            </div>
          </Card>
          <Card title="Estimates">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {input("estimate_prefix", "Number prefix")}
              {input("estimate_expiry_days", "Valid for (days)", { type: "number" })}
              {input("estimate_terms", "Default terms & conditions", { span: true, area: true })}
            </div>
          </Card>
          <Card title="Quotations (BDE)">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {input("company_legal_name", "Company name on quotations")}
              {input("company_website", "Website")}
              {input("quotation_prefix", "Number prefix")}
              {input("quotation_valid_days", "Valid for (days)", { type: "number" })}
              {input("quotation_intro", "Default engagement overview ({subject} and {client} are filled in)", { span: true, area: true })}
              {input("quotation_steps", "Default next steps (one per line: Title | text)", { span: true, area: true })}
              {input("quotation_terms", "Default terms (one per line: Label: text)", { span: true, area: true })}
              {input("quotation_closing", "Default closing line", { span: true })}
            </div>
          </Card>
          <div className="flex justify-end"><SubmitButton>Save settings</SubmitButton></div>
        </ActionForm>
      )}

      {tab === "items" && (
        <div className="space-y-6">
          <LookupTable
            title="Saved items / services"
            table="item"
            hint="Reusable lines you can drop into invoices and estimates."
            cols={[
              { key: "description", label: "Description" },
              { key: "longDescription", label: "Long description", type: "textarea" },
              { key: "rate", label: "Rate", type: "number", width: "w-32" },
              { key: "unit", label: "Unit", width: "w-24" },
              { key: "taxRate", label: "Tax %", type: "number", width: "w-24" },
            ]}
            rows={await db.item.findMany({ orderBy: { description: "asc" } })}
            save={saveLookup.bind(null, "item")}
            remove={deleteLookup}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <LookupTable title="Tax rates" table="tax" cols={[{ key: "name", label: "Name" }, { key: "rate", label: "Rate %", type: "number", width: "w-28" }]} rows={await db.tax.findMany({ orderBy: { rate: "desc" } })} save={saveLookup.bind(null, "tax")} remove={deleteLookup} />
            <LookupTable title="Payment modes" table="paymentMode" cols={[{ key: "name", label: "Name" }, { key: "active", label: "Active", type: "checkbox" }]} rows={await db.paymentMode.findMany()} save={saveLookup.bind(null, "paymentMode")} remove={deleteLookup} />
          </div>
        </div>
      )}

      {tab === "leads" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <LookupTable
            title="Lead statuses"
            table="leadStatus"
            hint="These are the columns on the leads kanban board. Statuses in use can't be deleted."
            cols={[{ key: "name", label: "Name" }, { key: "color", label: "Color", type: "color", width: "w-24" }, { key: "order", label: "Order", type: "number", width: "w-20" }]}
            rows={await db.leadStatus.findMany({ orderBy: { order: "asc" } })}
            save={saveLookup.bind(null, "leadStatus")}
            remove={deleteLookup}
          />
          <LookupTable title="Lead sources" table="leadSource" cols={[{ key: "name", label: "Name" }]} rows={await db.leadSource.findMany({ orderBy: { name: "asc" } })} save={saveLookup.bind(null, "leadSource")} remove={deleteLookup} />
        </div>
      )}

      {tab === "lists" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <LookupTable title="Expense categories" table="expenseCategory" cols={[{ key: "name", label: "Name" }]} rows={await db.expenseCategory.findMany({ orderBy: { name: "asc" } })} save={saveLookup.bind(null, "expenseCategory")} remove={deleteLookup} />
          <LookupTable title="Support departments" table="department" cols={[{ key: "name", label: "Name" }, { key: "email", label: "Email" }]} rows={await db.department.findMany()} save={saveLookup.bind(null, "department")} remove={deleteLookup} />
        </div>
      )}
    </>
  );
}
