import type { LineItem, Quotation } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { inputDate } from "@/lib/format";
import { CURRENCIES } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";
import { asSections, asSteps, parseStepLines, type Service } from "@/lib/quotation-content";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field } from "@/components/ui";
import { RecipientFields } from "./recipient";
import { ScopeEditor, ServicesEditor, StepsEditor } from "./editors";
import { AiAssist } from "./ai-assist";
import { aiProvider } from "@/lib/ai";

export type QuotationPreset = { leadId?: number; customerId?: number };

/** The form follows the PDF from top to bottom, so BDE fills it in the order the client reads it. */
export async function QuotationForm({
  action,
  quotation,
  preset,
  submitLabel,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  quotation?: Quotation & { items: LineItem[] };
  preset?: QuotationPreset;
  submitLabel: string;
}) {
  const [settings, leads, customers, saved, taxes] = await Promise.all([
    getSettings(),
    db.lead.findMany({ where: { lost: false, junk: false, customerId: null }, orderBy: { createdAt: "desc" }, take: 300, select: { id: true, name: true, company: true } }),
    db.customer.findMany({ where: { active: true }, orderBy: { company: "asc" }, select: { id: true, company: true } }),
    db.item.findMany({ orderBy: { description: "asc" }, select: { id: true, description: true, longDescription: true, rate: true, taxRate: true } }),
    db.tax.findMany({ orderBy: { rate: "desc" } }),
  ]);
  const q = quotation;

  // Recipient: an existing quotation keeps its saved details; a new one can be preset from a lead / customer page.
  const leadId = q?.leadId ?? preset?.leadId;
  const customerId = q?.customerId ?? preset?.customerId;
  const initialFor = leadId ? `lead:${leadId}` : customerId ? `customer:${customerId}` : "";
  let initial = { clientName: q?.clientName ?? "", clientCompany: q?.clientCompany ?? "", clientEmail: q?.clientEmail ?? "", clientPhone: q?.clientPhone ?? "", clientAddress: q?.clientAddress ?? "" };
  if (!q && preset?.leadId) {
    const l = await db.lead.findUnique({ where: { id: preset.leadId } });
    if (l) initial = { clientName: l.name, clientCompany: l.company ?? "", clientEmail: l.email ?? "", clientPhone: l.phone ?? "", clientAddress: [l.address, l.city, l.country].filter(Boolean).join(", ") };
  } else if (!q && preset?.customerId) {
    const c = await db.customer.findUnique({ where: { id: preset.customerId }, include: { contacts: { where: { active: true }, orderBy: { isPrimary: "desc" }, take: 1 } } });
    if (c) {
      const p = c.contacts[0];
      initial = { clientName: p ? `${p.firstName} ${p.lastName}`.trim() : c.company, clientCompany: c.company, clientEmail: p?.email ?? "", clientPhone: p?.phone ?? c.phone ?? "", clientAddress: [c.address, c.city, c.country].filter(Boolean).join(", ") };
    }
  }
  // Make sure the linked lead shows in the list even if it was converted or marked lost since.
  const leadOptions = leads.map((l) => ({ value: `lead:${l.id}`, label: l.company ? `${l.name} · ${l.company}` : l.name }));
  if (leadId && !leads.some((l) => l.id === leadId)) {
    const l = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, name: true, company: true } });
    if (l) leadOptions.unshift({ value: `lead:${l.id}`, label: l.company ? `${l.name} · ${l.company}` : l.name });
  }

  const currency = q?.currency ?? settings.currency;
  const validDays = Number(settings.quotation_valid_days || 0);
  const services: Service[] = (q?.items ?? []).map((i) => ({ tag: i.tag ?? "", title: i.description, points: i.longDescription ?? "", fee: i.qty * i.rate, note: i.note ?? "", taxRate: i.taxRate }));

  const ai = aiProvider();

  return (
    <ActionForm action={action} className="space-y-6">
      <AiAssist provider={`${ai.model} via ${ai.name}`} />

      <Card title="1 · Quotation for">
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Service / project *" className="sm:col-span-2" hint="Big heading in the “Quotation for” box">
            <input name="subject" required maxLength={120} defaultValue={q?.subject} placeholder="Website Development" className="input" />
          </Field>
          <Field label="Short description" className="sm:col-span-2" hint="Small line under it">
            <input name="subtitle" maxLength={120} defaultValue={q?.subtitle ?? ""} placeholder="Doctor / clinic website" className="input" />
          </Field>
          <Field label="Date">
            <input type="date" name="date" required defaultValue={inputDate(q?.date ?? new Date())} className="input" />
          </Field>
          <Field label="Valid until">
            <input type="date" name="validUntil" defaultValue={inputDate(q ? q.validUntil : validDays ? new Date(Date.now() + validDays * 86_400_000) : null)} className="input" />
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={currency} className="input">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card title="2 · Prepared for">
        <div className="p-5">
          <RecipientFields
            leads={leadOptions}
            customers={customers.map((c) => ({ value: `customer:${c.id}`, label: c.company }))}
            initialFor={initialFor}
            initial={initial}
          />
        </div>
      </Card>

      <Card title="3 · Engagement overview">
        <div className="p-5">
          <textarea name="intro" rows={3} defaultValue={q ? q.intro ?? "" : settings.quotation_intro} className="input" />
          <p className="mt-1 text-xs text-slate-400">
            <code>{"{subject}"}</code> and <code>{"{client}"}</code> are replaced with the service and the client&apos;s name when you save.
          </p>
        </div>
      </Card>

      <Card title="4 · Services & pricing">
        <ServicesEditor
          initial={services}
          saved={saved}
          taxRates={taxes.map((t) => ({ label: `${t.name} ${t.rate}%`, rate: t.rate }))}
          currency={currency}
          initialDiscount={q?.discountPercent}
          initialAdjustment={q?.adjustment}
        />
      </Card>

      <Card title="5 · Scope of work (optional, detailed)">
        <ScopeEditor initialIntro={q?.scopeIntro ?? ""} initialSections={asSections(q?.scope)} />
      </Card>

      <Card title="6 · Acceptance & next steps">
        <StepsEditor initial={q ? asSteps(q.steps) : parseStepLines(settings.quotation_steps)} />
      </Card>

      <Card title="7 · Terms & closing">
        <div className="grid gap-4 p-5">
          <Field label="Terms & conditions" hint="One per line as “Label: text”. The label is shown in bold. Fees and the total are added automatically from the services.">
            <textarea name="terms" rows={5} defaultValue={q ? q.terms ?? "" : settings.quotation_terms} className="input" />
          </Field>
          <Field label="Closing line">
            <input name="closing" maxLength={200} defaultValue={q ? q.closing ?? "" : settings.quotation_closing} className="input" />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
