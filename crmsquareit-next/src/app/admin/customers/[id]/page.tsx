import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDate, money } from "@/lib/format";
import { docNumber, isOverdue } from "@/lib/sales";
import { INVOICE_STATUS, ESTIMATE_STATUS, PROJECT_STATUS, TICKET_STATUS } from "@/lib/constants";
import { Badge, ButtonLink, Card, DetailRow, EmptyState, PageHeader, Stat, StatusBadge, Table, Tabs } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/client";
import { PAYMENT_TYPES, billingOf } from "@/lib/customer-billing";
import { inputDate } from "@/lib/format";
import { Notes } from "@/components/notes";
import { Contacts } from "./contacts";
import { deleteCustomer, saveContact, deleteContact, addCustomerPayment, deleteCustomerPayment } from "../actions";

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePerm("customers");
  const { id } = await params;
  const { tab = "profile" } = await searchParams;
  const c = await db.customer.findUnique({
    where: { id: Number(id) },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }] },
      invoices: { orderBy: { date: "desc" }, include: { payments: true } },
      estimates: { orderBy: { date: "desc" } },
      projects: { orderBy: { createdAt: "desc" } },
      tickets: { orderBy: { createdAt: "desc" } },
      quotations: { where: { status: "ACCEPTED" }, orderBy: { date: "desc" }, select: { id: true, prefix: true, number: true, subject: true, date: true, total: true, currency: true } },
      payments: { orderBy: [{ date: "desc" }, { id: "desc" }], include: { staff: { select: { firstName: true } }, quotation: { select: { prefix: true, number: true } } } },
      leads: { take: 1, select: { id: true, name: true } },
    },
  });
  if (!c) notFound();
  const [b, modes] = await Promise.all([billingOf(c.id), db.paymentMode.findMany({ where: { active: true }, orderBy: { name: "asc" } })]);
  const canPay = can(user, "customers", "edit");
  const pct = b.billed ? Math.min(100, Math.round((b.paid / b.billed) * 100)) : 0;
  const payStatus = !b.billed ? null : b.outstanding <= 0 ? "Fully paid" : b.paid > 0 ? "Partly paid" : "Unpaid";
  const cur = c.currency || "INR";
  const base = `/admin/customers/${c.id}`;

  return (
    <>
      <PageHeader
        title={c.company}
        subtitle={[c.city, c.country].filter(Boolean).join(", ")}
        back={{ href: "/admin/customers", label: "Customers" }}
        actions={
          <>
            {!c.active && <Badge>Inactive</Badge>}
            {can(user, "quotations", "create") && <ButtonLink variant="secondary" href={`/admin/quotations/new?customerId=${c.id}`}>New quotation</ButtonLink>}
            {can(user, "invoices", "create") && <ButtonLink variant="secondary" href={`/admin/invoices/new?customerId=${c.id}`}>New invoice</ButtonLink>}
            {can(user, "customers", "edit") && <ButtonLink variant="secondary" href={`${base}/edit`}>Edit</ButtonLink>}
            {can(user, "customers", "delete") && <ConfirmButton action={deleteCustomer} hidden={{ id: c.id }} />}
          </>
        }
      />
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Total billed"
          value={money(b.billed, cur)}
          sub={b.billedFrom === "quotations" ? `From ${c.quotations.length} won quotation${c.quotations.length === 1 ? "" : "s"}` : b.billedFrom === "invoices" ? "From invoices" : "No won quotation yet"}
          accent="blue"
          href={`${base}?tab=payments`}
        />
        <Stat label="Advance received" value={money(b.advance, cur)} sub="Paid up front" accent="green" href={`${base}?tab=payments`} />
        <Stat label="Paid at once" value={money(b.full, cur)} sub="Full payment in one go" accent="green" href={`${base}?tab=payments`} />
        <Stat label="Part payments" value={money(b.part + b.invoicePaid, cur)} sub={b.invoicePaid ? `incl. ${money(b.invoicePaid, cur)} on invoices` : "Instalments & balance"} accent="yellow" href={`${base}?tab=payments`} />
        <Stat label="Outstanding" value={money(b.outstanding, cur)} sub={payStatus ?? "Nothing billed"} accent="red" href={`${base}?tab=payments`} />
      </div>
      {b.billed > 0 && (
        <div className="mb-6">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>
              {money(b.paid, cur)} received of {money(b.billed, cur)}
            </span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={b.outstanding <= 0 ? "h-full bg-brand-green" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <Tabs
        base={base}
        active={tab}
        tabs={[
          { key: "profile", label: "Profile" },
          { key: "payments", label: "Payments", count: c.payments.length },
          { key: "contacts", label: "Contacts", count: c.contacts.length },
          { key: "invoices", label: "Invoices", count: c.invoices.length },
          { key: "estimates", label: "Estimates", count: c.estimates.length },
          { key: "projects", label: "Projects", count: c.projects.length },
          { key: "tickets", label: "Tickets", count: c.tickets.length },
          { key: "notes", label: "Notes" },
        ]}
      />

      {tab === "profile" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Company">
            <dl className="divide-y divide-slate-100 px-5">
              <DetailRow label="Company">{c.company}</DetailRow>
              <DetailRow label="GST / VAT">{c.vat}</DetailRow>
              <DetailRow label="Phone">{c.phone}</DetailRow>
              <DetailRow label="Website">{c.website && <a href={c.website} target="_blank" className="link">{c.website}</a>}</DetailRow>
              <DetailRow label="Currency">{cur}</DetailRow>
              <DetailRow label="Customer since">{fmtDate(c.createdAt)}</DetailRow>
            </dl>
          </Card>
          <Card title="Address">
            <dl className="divide-y divide-slate-100 px-5">
              <DetailRow label="Address">{c.address}</DetailRow>
              <DetailRow label="City">{c.city}</DetailRow>
              <DetailRow label="State">{c.state}</DetailRow>
              <DetailRow label="ZIP / PIN">{c.zip}</DetailRow>
              <DetailRow label="Country">{c.country}</DetailRow>
            </dl>
            {c.notes && <p className="whitespace-pre-wrap border-t border-slate-100 px-5 py-4 text-sm text-slate-600">{c.notes}</p>}
          </Card>
        </div>
      )}

      {tab === "payments" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            {canPay && (
              <Card title="Record a payment">
                {b.billed > 0 && b.outstanding <= 0 ? (
                  <p className="p-5 text-sm text-brand-green">Fully paid. Nothing is outstanding.</p>
                ) : (
                  <ActionForm action={addCustomerPayment.bind(null, c.id)} resetOnSuccess savedText="Payment recorded." className="space-y-3 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(PAYMENT_TYPES).map(([k, t], i) => (
                        <label key={k} className="cursor-pointer">
                          <input type="radio" name="type" value={k} defaultChecked={i === (b.paid > 0 ? 2 : 0)} className="peer sr-only" />
                          <span className="block rounded-lg border border-slate-200 px-3 py-2 peer-checked:border-primary peer-checked:bg-primary/10">
                            <span className="block text-sm font-medium text-slate-700">{t.label}</span>
                            <span className="block text-[11px] text-slate-500">{t.hint}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <div>
                      <span className="label">Amount ({cur})</span>
                      <input name="amount" type="number" step="0.01" min="0" className="input" placeholder={b.outstanding ? `Outstanding: ${b.outstanding}` : "0.00"} />
                      <p className="mt-1 text-[11px] text-slate-500">Leave empty for "Paid at once" or "Final balance" to record the full outstanding amount.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="label">Date</span>
                        <input name="date" type="date" className="input" defaultValue={inputDate(new Date())} />
                      </div>
                      <div>
                        <span className="label">Mode</span>
                        <select name="mode" className="input" defaultValue="">
                          <option value="">—</option>
                          {modes.map((m) => (
                            <option key={m.id} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {c.quotations.length > 1 && (
                      <div>
                        <span className="label">Against quotation</span>
                        <select name="quotationId" className="input" defaultValue={c.quotations[0].id}>
                          {c.quotations.map((q) => (
                            <option key={q.id} value={q.id}>{docNumber(q.prefix, q.number)} · {q.subject}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {c.quotations.length === 1 && <input type="hidden" name="quotationId" value={c.quotations[0].id} />}
                    <input name="reference" className="input" placeholder="Transaction / cheque no. (optional)" />
                    <input name="note" className="input" placeholder="Note (optional)" />
                    <div className="flex justify-end">
                      <SubmitButton>Record payment</SubmitButton>
                    </div>
                  </ActionForm>
                )}
              </Card>
            )}
            <Card title="Won quotations">
              {c.quotations.length === 0 ? (
                <EmptyState
                  title="No won quotation"
                  text="Total billed comes from accepted quotations. Mark the client's quotation as accepted, or convert their lead."
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {c.quotations.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <Link href={`/admin/quotations/${q.id}`} className="link font-medium">{docNumber(q.prefix, q.number)}</Link>
                        <p className="truncate text-xs text-slate-500">{q.subject} · {fmtDate(q.date)}</p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{money(q.total, q.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {c.leads[0] && (
                <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
                  Converted from lead <Link href={`/admin/leads/${c.leads[0].id}`} className="link">{c.leads[0].name}</Link>
                </p>
              )}
            </Card>
          </div>
          <Card title="Payment history" className="lg:col-span-2">
            {c.payments.length === 0 ? (
              <EmptyState title="No payments yet" text="Record the advance or full payment when the client pays." />
            ) : (
              <Table head={["Date", "Type", "Amount", "Mode", "Reference", "Quotation", "By", ""]}>
                {c.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="td whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="td">
                      <Badge tone={p.type === "ADVANCE" ? "blue" : p.type === "FULL" ? "green" : p.type === "BALANCE" ? "purple" : "amber"}>{PAYMENT_TYPES[p.type]?.label ?? p.type}</Badge>
                    </td>
                    <td className="td font-semibold tabular-nums">{money(p.amount, cur)}</td>
                    <td className="td">{p.mode ?? "—"}</td>
                    <td className="td text-xs">
                      {p.reference ?? "—"}
                      {p.note && <div className="text-slate-500">{p.note}</div>}
                    </td>
                    <td className="td text-xs">{p.quotation ? docNumber(p.quotation.prefix, p.quotation.number) : "—"}</td>
                    <td className="td text-xs">{p.staff?.firstName ?? "—"}</td>
                    <td className="td text-right">
                      {canPay && <ConfirmButton action={deleteCustomerPayment} hidden={{ id: p.id }} label="✕" confirmLabel="Delete?" variant="ghost" className="px-2 py-1 text-xs" />}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 text-sm sm:grid-cols-4">
              {[
                ["Advance", b.advance],
                ["Paid at once", b.full],
                ["Part / balance", b.part + b.invoicePaid],
                ["Outstanding", b.outstanding],
              ].map(([label, v]) => (
                <div key={label as string} className="bg-white px-5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className={label === "Outstanding" && (v as number) > 0 ? "font-bold text-brand-red" : "font-bold text-ink"}>{money(v as number, cur)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "contacts" && (
        <Contacts contacts={c.contacts} save={saveContact.bind(null, c.id)} remove={deleteContact} canEdit={can(user, "customers", "edit")} />
      )}

      {tab === "invoices" && (
        <Card>
          {c.invoices.length === 0 ? (
            <EmptyState title="No invoices" action={<ButtonLink href={`/admin/invoices/new?customerId=${c.id}`}>Create invoice</ButtonLink>} />
          ) : (
            <Table head={["Invoice", "Date", "Due", "Total", "Status"]}>
              {c.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="td"><Link className="link" href={`/admin/invoices/${i.id}`}>{docNumber(i.prefix, i.number)}</Link></td>
                  <td className="td">{fmtDate(i.date)}</td>
                  <td className="td">{fmtDate(i.dueDate)}</td>
                  <td className="td font-medium">{money(i.total, i.currency)}</td>
                  <td className="td"><StatusBadge map={INVOICE_STATUS} value={isOverdue(i) ? "OVERDUE" : i.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "estimates" && (
        <Card>
          {c.estimates.length === 0 ? (
            <EmptyState title="No estimates" action={<ButtonLink href={`/admin/estimates/new?customerId=${c.id}`}>Create estimate</ButtonLink>} />
          ) : (
            <Table head={["Estimate", "Date", "Expiry", "Total", "Status"]}>
              {c.estimates.map((e) => (
                <tr key={e.id}>
                  <td className="td"><Link className="link" href={`/admin/estimates/${e.id}`}>{docNumber(e.prefix, e.number)}</Link></td>
                  <td className="td">{fmtDate(e.date)}</td>
                  <td className="td">{fmtDate(e.expiryDate)}</td>
                  <td className="td font-medium">{money(e.total, e.currency)}</td>
                  <td className="td"><StatusBadge map={ESTIMATE_STATUS} value={e.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "projects" && (
        <Card>
          {c.projects.length === 0 ? (
            <EmptyState title="No projects" action={<ButtonLink href={`/admin/projects/new?customerId=${c.id}`}>Create project</ButtonLink>} />
          ) : (
            <Table head={["Project", "Start", "Deadline", "Progress", "Status"]}>
              {c.projects.map((p) => (
                <tr key={p.id}>
                  <td className="td"><Link className="link" href={`/admin/projects/${p.id}`}>{p.name}</Link></td>
                  <td className="td">{fmtDate(p.startDate)}</td>
                  <td className="td">{fmtDate(p.deadline)}</td>
                  <td className="td">{p.progress}%</td>
                  <td className="td"><StatusBadge map={PROJECT_STATUS} value={p.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "tickets" && (
        <Card>
          {c.tickets.length === 0 ? (
            <EmptyState title="No tickets" />
          ) : (
            <Table head={["#", "Subject", "Created", "Status"]}>
              {c.tickets.map((t) => (
                <tr key={t.id}>
                  <td className="td">#{t.id}</td>
                  <td className="td"><Link className="link" href={`/admin/tickets/${t.id}`}>{t.subject}</Link></td>
                  <td className="td">{fmtDate(t.createdAt)}</td>
                  <td className="td"><StatusBadge map={TICKET_STATUS} value={t.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "notes" && <Notes relType="customer" relId={c.id} path={`${base}?tab=notes`} />}
    </>
  );
}
