import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("customers");
  const sp = await searchParams;
  const { page, skip, take } = pageArgs(sp.page);
  const where: Prisma.CustomerWhereInput = {};
  if (sp.q) where.OR = [{ company: { contains: sp.q } }, { phone: { contains: sp.q } }, { city: { contains: sp.q } }, { contacts: { some: { email: { contains: sp.q } } } }];
  if (sp.active) where.active = sp.active === "1";
  const [rows, total, counts] = await Promise.all([
    db.customer.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { contacts: { where: { isPrimary: true }, take: 1 }, _count: { select: { projects: true, invoices: true } } },
    }),
    db.customer.count({ where }),
    db.customer.groupBy({ by: ["active"], _count: true }),
  ]);
  const active = counts.find((c) => c.active)?._count ?? 0;
  const inactive = counts.find((c) => !c.active)?._count ?? 0;

  return (
    <>
      <PageHeader title="Customers" subtitle={`${active} active · ${inactive} inactive`} actions={<ButtonLink href="/admin/customers/new">+ New customer</ButtonLink>} />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <SearchBox placeholder="Search company, phone, email…" />
          <FilterSelect name="active" placeholder="All customers" options={[{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }]} />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No customers found" action={<ButtonLink href="/admin/customers/new">Add customer</ButtonLink>} />
        ) : (
          <Table head={["Company", "Primary contact", "Phone", "City", "Projects", "Invoices", "Status", "Since"]}>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <td className="td">
                  <Link href={`/admin/customers/${c.id}`} className="link">
                    {c.company}
                  </Link>
                </td>
                <td className="td">
                  {c.contacts[0] ? (
                    <>
                      <div>{c.contacts[0].firstName} {c.contacts[0].lastName}</div>
                      <div className="text-xs text-slate-500">{c.contacts[0].email}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="td">{c.phone ?? "—"}</td>
                <td className="td">{c.city ?? "—"}</td>
                <td className="td">{c._count.projects}</td>
                <td className="td">{c._count.invoices}</td>
                <td className="td">{c.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                <td className="td text-slate-500">{fmtDate(c.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}
