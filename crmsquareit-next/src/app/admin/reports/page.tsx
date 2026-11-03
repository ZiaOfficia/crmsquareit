import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader, Stat, Table } from "@/components/ui";
import { RevenueChart, DonutChart } from "@/components/charts";
import { FilterSelect } from "@/components/client";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requirePerm("reports");
  const sp = await searchParams;
  const { currency } = await getSettings();
  const year = Number(sp.year) || new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const [payments, expenses, invoices, leads, sources, customers] = await Promise.all([
    db.payment.findMany({ where: { date: { gte: from, lt: to } }, include: { invoice: { select: { customerId: true } } } }),
    db.expense.findMany({ where: { date: { gte: from, lt: to } }, include: { category: true } }),
    db.invoice.findMany({ where: { date: { gte: from, lt: to }, status: { not: "CANCELLED" } }, select: { status: true, total: true, taxTotal: true } }),
    db.lead.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { sourceId: true, customerId: true } }),
    db.leadSource.findMany(),
    db.customer.findMany({ select: { id: true, company: true } }),
  ]);
  const months = Array.from({ length: 12 }, (_, m) => ({ month: new Date(year, m, 1).toLocaleString("en", { month: "short" }), revenue: 0, expenses: 0 }));
  payments.forEach((p) => (months[p.date.getMonth()].revenue += p.amount));
  expenses.forEach((e) => (months[e.date.getMonth()].expenses += e.amount));
  const income = payments.reduce((s, p) => s + p.amount, 0);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const tax = invoices.filter((i) => i.status !== "DRAFT").reduce((s, i) => s + i.taxTotal, 0);

  const byCustomer = new Map<number, number>();
  payments.forEach((p) => byCustomer.set(p.invoice.customerId, (byCustomer.get(p.invoice.customerId) ?? 0) + p.amount));
  const top = [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const byCat = new Map<string, number>();
  expenses.forEach((e) => byCat.set(e.category.name, (byCat.get(e.category.name) ?? 0) + e.amount));
  const palette = ["#4f74c4", "#27ae57", "#e0a400", "#e84a37", "#7c5cc4", "#0f9fb0", "#94a3b8"];
  const firstYear = 2020;
  const years = Array.from({ length: new Date().getFullYear() - firstYear + 2 }, (_, i) => String(new Date().getFullYear() + 1 - i));

  return (
    <>
      <PageHeader title={`Reports · ${year}`} actions={<FilterSelect name="year" placeholder={`This year`} options={years.map((y) => ({ value: y, label: y }))} />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Income received" value={money(income, currency)} accent="green" />
        <Stat label="Expenses" value={money(spent, currency)} accent="red" />
        <Stat label="Net profit" value={money(income - spent, currency)} accent="blue" />
        <Stat label="Tax invoiced" value={money(tax, currency)} accent="yellow" />
      </div>
      <Card title="Income vs expenses by month" className="mb-6"><div className="p-4"><RevenueChart data={months} /></div></Card>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Top customers by payments" className="xl:col-span-2">
          <Table head={["Customer", "Paid"]}>
            {top.map(([id, amt]) => (
              <tr key={id}><td className="td">{customers.find((c) => c.id === id)?.company}</td><td className="td font-semibold">{money(amt, currency)}</td></tr>
            ))}
            {top.length === 0 && <tr><td colSpan={2} className="px-5 py-6 text-center text-sm text-slate-400">No payments this year.</td></tr>}
          </Table>
        </Card>
        <Card title="Expenses by category"><div className="p-5"><DonutChart data={[...byCat.entries()].map(([name, value], i) => ({ name, value: Math.round(value), color: palette[i % palette.length] }))} /></div></Card>
      </div>
      <Card title="Lead conversion by source" className="mt-6">
        <Table head={["Source", "Leads", "Converted", "Conversion rate"]}>
          {[...sources, { id: null as number | null, name: "No source" }].map((s) => {
            const list = leads.filter((l) => l.sourceId === s.id);
            if (!list.length) return null;
            const conv = list.filter((l) => l.customerId).length;
            return (
              <tr key={String(s.id)}>
                <td className="td">{s.name}</td><td className="td">{list.length}</td><td className="td">{conv}</td>
                <td className="td"><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-green" style={{ width: `${(conv / list.length) * 100}%` }} /></div>{Math.round((conv / list.length) * 100)}%</div></td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
