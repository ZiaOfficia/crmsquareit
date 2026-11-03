import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/constants";
import { Avatar, ButtonLink, Card, EmptyState, PageHeader, StatusBadge, Table } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("projects");
  const sp = await searchParams;
  const { page, skip, take } = pageArgs(sp.page);
  const where: Prisma.ProjectWhereInput = {};
  if (sp.status) where.status = sp.status;
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { customer: { company: { contains: sp.q } } }];
  const [rows, total, groups] = await Promise.all([
    db.project.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      include: { customer: { select: { company: true } }, members: true, _count: { select: { tasks: true } }, tasks: { where: { status: "COMPLETE" }, select: { id: true } } },
    }),
    db.project.count({ where }),
    db.project.groupBy({ by: ["status"], _count: true }),
  ]);
  return (
    <>
      <PageHeader title="Projects" actions={<ButtonLink href="/admin/projects/new">+ New project</ButtonLink>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries(PROJECT_STATUS).map(([k, v]) => (
          <Link key={k} href={`?status=${k}`} className="card px-4 py-3 hover:shadow-md">
            <p className="text-2xl font-bold text-ink">{groups.find((g) => g.status === k)?._count ?? 0}</p>
            <p className="text-xs text-slate-500">{v.label}</p>
          </Link>
        ))}
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <SearchBox placeholder="Search projects…" />
          <FilterSelect name="status" placeholder="All statuses" options={Object.entries(PROJECT_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No projects" action={<ButtonLink href="/admin/projects/new">Create project</ButtonLink>} />
        ) : (
          <Table head={["Project", "Customer", "Members", "Tasks", "Progress", "Start", "Deadline", "Status"]}>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60">
                <td className="td"><Link className="link" href={`/admin/projects/${p.id}`}>{p.name}</Link></td>
                <td className="td">{p.customer.company}</td>
                <td className="td"><div className="flex -space-x-2">{p.members.slice(0, 4).map((m) => <Avatar key={m.id} name={`${m.firstName} ${m.lastName}`} size={26} />)}</div></td>
                <td className="td">{p.tasks.length}/{p._count.tasks}</td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-green" style={{ width: `${p.progress}%` }} /></div>
                    <span className="text-xs text-slate-500">{p.progress}%</span>
                  </div>
                </td>
                <td className="td">{fmtDate(p.startDate)}</td>
                <td className="td">{fmtDate(p.deadline)}</td>
                <td className="td"><StatusBadge map={PROJECT_STATUS} value={p.status} /></td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}
