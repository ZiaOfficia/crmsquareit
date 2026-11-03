import { requireUser } from "@/lib/auth";
import { can, MODULES } from "@/lib/permissions";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { db } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const allowed = Object.fromEntries(MODULES.map((m) => [m.key, can(user, m.key)]));
  const openTickets = allowed.tickets ? await db.ticket.count({ where: { status: "OPEN" } }) : 0;
  return (
    <div className="min-h-screen">
      <Sidebar allowed={allowed} isAdmin={user.isAdmin} badges={{ tickets: openTickets }} />
      <div className="lg:pl-64">
        <Topbar name={`${user.firstName} ${user.lastName}`} role={user.roleName ?? "Staff"} />
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
