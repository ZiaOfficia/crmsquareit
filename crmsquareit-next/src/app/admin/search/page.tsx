import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { docNumber } from "@/lib/sales";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = ((await searchParams).q ?? "").trim();
  if (!q) return <PageHeader title="Search" subtitle="Type in the search bar above." />;
  const n = parseInt(q.replace(/\D/g, ""), 10);
  const [customers, leads, invoices, projects, tasks, tickets] = await Promise.all([
    can(user, "customers") ? db.customer.findMany({ where: { OR: [{ company: { contains: q } }, { phone: { contains: q } }, { contacts: { some: { OR: [{ email: { contains: q } }, { firstName: { contains: q } }] } } }] }, take: 8 }) : [],
    can(user, "leads") ? db.lead.findMany({ where: { OR: [{ name: { contains: q } }, { company: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }, take: 8 }) : [],
    can(user, "invoices") && Number.isFinite(n) ? db.invoice.findMany({ where: { number: n }, include: { customer: true }, take: 8 }) : [],
    can(user, "projects") ? db.project.findMany({ where: { name: { contains: q } }, take: 8 }) : [],
    can(user, "tasks") ? db.task.findMany({ where: { name: { contains: q } }, take: 8 }) : [],
    can(user, "tickets") ? db.ticket.findMany({ where: { subject: { contains: q } }, take: 8 }) : [],
  ]);
  const groups = [
    { title: "Customers", items: customers.map((c) => ({ href: `/admin/customers/${c.id}`, label: c.company })) },
    { title: "Leads", items: leads.map((l) => ({ href: `/admin/leads/${l.id}`, label: `${l.name}${l.company ? ` · ${l.company}` : ""}` })) },
    { title: "Invoices", items: invoices.map((i) => ({ href: `/admin/invoices/${i.id}`, label: `${docNumber(i.prefix, i.number)} · ${i.customer.company}` })) },
    { title: "Projects", items: projects.map((p) => ({ href: `/admin/projects/${p.id}`, label: p.name })) },
    { title: "Tasks", items: tasks.map((t) => ({ href: `/admin/tasks/${t.id}`, label: t.name })) },
    { title: "Tickets", items: tickets.map((t) => ({ href: `/admin/tickets/${t.id}`, label: `#${t.id} ${t.subject}` })) },
  ].filter((g) => g.items.length);
  return (
    <>
      <PageHeader title={`Results for “${q}”`} />
      {groups.length === 0 ? (
        <Card><EmptyState title="Nothing found" text="Try a different name, email, phone or invoice number." /></Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.title} title={g.title}>
              <ul className="divide-y divide-slate-100">
                {g.items.map((i) => <li key={i.href}><Link href={i.href} className="block px-5 py-2.5 text-sm hover:bg-slate-50 hover:text-primary">{i.label}</Link></li>)}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
