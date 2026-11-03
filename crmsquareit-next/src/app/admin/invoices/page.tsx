import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, money } from "@/lib/format";
import { docNumber, isOverdue } from "@/lib/sales";
import { getSettings } from "@/lib/settings";
import { INVOICE_STATUS } from "@/lib/constants";
import { ButtonLink, Card, EmptyState, PageHeader, Stat, StatusBadge, Table } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("invoices");
  const sp = await searchParams;
  const { page, skip, take } = pageArgs(sp.page);
  const { currency } = await getSettings();
  const today = new Date(new Date().toDateString());
  const where: Prisma.InvoiceWhereInput = {};
  if (sp.status === "OVERDUE") Object.assign(where, { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today } });
  else if (sp.status) where.status = sp.status;
  if (sp.customer) where.customerId = Number(sp.customer);
  if (sp.q) {
    const n = parseInt(sp.q.replace(/\D/g, ""), 10);
    where.OR = [{ customer: { company: { contains: sp.q } } }, ...(Number.isFinite(n) ? [{ number: n }] : [])];
  }
  const [rows, total, customers, all] = await Promise.all([
    db.invoice.findMany({ where, skip, take, orderBy: [{ date: "desc" }, { number: "desc" }], include: { customer: { select: { company: true } }, payments: { select: { amount: true } } } }),
    db.invoice.count({ where }),
    db.customer.findMany({ orderBy: { company: "asc" }, select: { id: true, company: true } }),
    db.invoice.findMany({ where: { status: { notIn: ["DRAFT", "CANCELLED"] } }, select: { total: true, status: true, dueDate: true, payments: { select: { amount: true } } } }),
  ]);
  const paidSum = all.reduce((s, i) => s + i.payments.reduce((a, p) => a + p.amount, 0), 0);
  const billed = all.reduce((s, i) => s + i.total, 0);
  const overdueSum = all.filter(isOverdue).reduce((s, i) => s + i.total - i.payments.reduce((a, p) => a + p.amount, 0), 0);

  return (
    <>
      <PageHeader title="Invoices" actions={<ButtonLink href="/admin/invoices/new">+ New invoice</ButtonLink>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Outstanding" value={money(billed - paidSum, currency)} accent="yellow" href="/admin/invoices?status=UNPAID" />
        <Stat label="Overdue" value={money(overdueSum, currency)} accent="red" href="/admin/invoices?status=OVERDUE" />
        <Stat label="Paid (all time)" value={money(paidSum, currency)} accent="green" href="/admin/invoices?status=PAID" />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <SearchBox placeholder="Invoice # or customer…" />
          <FilterSelect name="status" placeholder="All statuses" options={Object.entries(INVOICE_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
          <FilterSelect name="customer" placeholder="All customers" options={customers.map((c) => ({ value: String(c.id), label: c.company }))} />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No invoices found" action={<ButtonLink href="/admin/invoices/new">Create invoice</ButtonLink>} />
        ) : (
          <Table head={["Invoice", "Customer", "Date", "Due date", "Amount", "Due", "Status"]}>
            {rows.map((i) => {
              const due = i.total - i.payments.reduce((a, p) => a + p.amount, 0);
              return (
                <tr key={i.id} className="hover:bg-slate-50/60">
                  <td className="td"><Link className="link" href={`/admin/invoices/${i.id}`}>{docNumber(i.prefix, i.number)}</Link></td>
                  <td className="td">{i.customer.company}</td>
                  <td className="td">{fmtDate(i.date)}</td>
                  <td className="td">{fmtDate(i.dueDate)}</td>
                  <td className="td font-medium">{money(i.total, i.currency)}</td>
                  <td className="td">{i.status === "CANCELLED" ? "—" : money(Math.max(0, due), i.currency)}</td>
                  <td className="td"><StatusBadge map={INVOICE_STATUS} value={isOverdue(i) ? "OVERDUE" : i.status} /></td>
                </tr>
              );
            })}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}
