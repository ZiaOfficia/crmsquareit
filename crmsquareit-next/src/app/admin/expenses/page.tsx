import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, money } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Stat, Table } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("expenses");
  const sp = await searchParams;
  const { page, skip, take } = pageArgs(sp.page);
  const { currency } = await getSettings();
  const where: Prisma.ExpenseWhereInput = {};
  if (sp.category) where.categoryId = Number(sp.category);
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { reference: { contains: sp.q } }];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [rows, total, cats, month, sum] = await Promise.all([
    db.expense.findMany({ where, skip, take, orderBy: { date: "desc" }, include: { category: true, customer: true, project: true } }),
    db.expense.count({ where }),
    db.expenseCategory.findMany(),
    db.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart } } }),
    db.expense.aggregate({ _sum: { amount: true }, where }),
  ]);
  return (
    <>
      <PageHeader title="Expenses" actions={<ButtonLink href="/admin/expenses/new">+ Record expense</ButtonLink>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat label="This month" value={money(month._sum.amount ?? 0, currency)} accent="red" />
        <Stat label="Total (filtered)" value={money(sum._sum.amount ?? 0, currency)} accent="yellow" />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <SearchBox placeholder="Search expenses…" />
          <FilterSelect name="category" placeholder="All categories" options={cats.map((c) => ({ value: String(c.id), label: c.name }))} />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No expenses" action={<ButtonLink href="/admin/expenses/new">Record expense</ButtonLink>} />
        ) : (
          <Table head={["Name", "Category", "Date", "Customer / project", "Mode", "Amount"]}>
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/60">
                <td className="td"><Link className="link" href={`/admin/expenses/${e.id}`}>{e.name}</Link> {e.billable && <Badge tone="blue">Billable</Badge>}</td>
                <td className="td">{e.category.name}</td>
                <td className="td">{fmtDate(e.date)}</td>
                <td className="td text-slate-500">{[e.customer?.company, e.project?.name].filter(Boolean).join(" / ") || "—"}</td>
                <td className="td">{e.paymentMode ?? "—"}</td>
                <td className="td font-semibold">{money(e.amount, currency)}</td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}
