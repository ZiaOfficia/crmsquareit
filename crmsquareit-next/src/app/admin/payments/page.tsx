import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, money } from "@/lib/format";
import { docNumber } from "@/lib/sales";
import { getSettings } from "@/lib/settings";
import { Card, EmptyState, PageHeader, Stat, Table } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("payments");
  const sp = await searchParams;
  const { page, skip, take } = pageArgs(sp.page);
  const { currency } = await getSettings();
  const where: Prisma.PaymentWhereInput = {};
  if (sp.mode) where.mode = sp.mode;
  if (sp.q) where.OR = [{ transactionId: { contains: sp.q } }, { invoice: { customer: { company: { contains: sp.q } } } }];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [rows, total, modes, month, year] = await Promise.all([
    db.payment.findMany({ where, skip, take, orderBy: { date: "desc" }, include: { invoice: { include: { customer: { select: { id: true, company: true } } } } } }),
    db.payment.count({ where }),
    db.paymentMode.findMany(),
    db.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: yearStart } } }),
  ]);
  return (
    <>
      <PageHeader title="Payments" subtitle="Payments are recorded from an invoice" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat label="This month" value={money(month._sum.amount ?? 0, currency)} accent="green" />
        <Stat label="This year" value={money(year._sum.amount ?? 0, currency)} accent="blue" />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <SearchBox placeholder="Customer or transaction ID…" />
          <FilterSelect name="mode" placeholder="All payment modes" options={modes.map((m) => ({ value: m.name, label: m.name }))} />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No payments yet" text="Open an invoice and use “Record payment”." />
        ) : (
          <Table head={["#", "Invoice", "Customer", "Mode", "Transaction ID", "Date", "Amount"]}>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60">
                <td className="td text-slate-400">{p.id}</td>
                <td className="td"><Link className="link" href={`/admin/invoices/${p.invoiceId}`}>{docNumber(p.invoice.prefix, p.invoice.number)}</Link></td>
                <td className="td"><Link className="hover:text-primary" href={`/admin/customers/${p.invoice.customer.id}`}>{p.invoice.customer.company}</Link></td>
                <td className="td">{p.mode}</td>
                <td className="td text-slate-500">{p.transactionId ?? "—"}</td>
                <td className="td">{fmtDate(p.date)}</td>
                <td className="td font-semibold text-brand-green">{money(p.amount, p.invoice.currency)}</td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}
