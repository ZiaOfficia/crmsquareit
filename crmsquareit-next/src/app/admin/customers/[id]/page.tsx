import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDate, money } from "@/lib/format";
import { docNumber, isOverdue } from "@/lib/sales";
import { INVOICE_STATUS, ESTIMATE_STATUS, PROJECT_STATUS, TICKET_STATUS } from "@/lib/constants";
import { Badge, ButtonLink, Card, DetailRow, EmptyState, PageHeader, Stat, StatusBadge, Table, Tabs } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { Notes } from "@/components/notes";
import { Contacts } from "./contacts";
import { deleteCustomer, saveContact, deleteContact } from "../actions";

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
    },
  });
  if (!c) notFound();
  const cur = c.currency || "INR";
  const billed = c.invoices.filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED").reduce((s, i) => s + i.total, 0);
  const paid = c.invoices.reduce((s, i) => s + i.payments.reduce((a, p) => a + p.amount, 0), 0);
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
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total billed" value={money(billed, cur)} accent="blue" />
        <Stat label="Paid" value={money(paid, cur)} accent="green" />
        <Stat label="Outstanding" value={money(Math.max(0, billed - paid), cur)} accent="red" />
      </div>
      <Tabs
        base={base}
        active={tab}
        tabs={[
          { key: "profile", label: "Profile" },
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
