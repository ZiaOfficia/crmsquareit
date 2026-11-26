import { requireUser } from "@/lib/auth";
import { can, MODULES } from "@/lib/permissions";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { AnnouncementBanner, type InboxItem } from "@/components/announcements";
import { db } from "@/lib/db";
import { canTrackTeam, getTaskScope } from "@/lib/task-access";
import { membershipLabel } from "@/lib/org";
import { announcementOrder, inboxFor, unreadWhere } from "@/lib/announcements";
import { AssistantWidget } from "@/components/assistant";

const BANNER_MAX = 3;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const allowed: Record<string, boolean> = Object.fromEntries(MODULES.map((m) => [m.key, can(user, m.key)]));
  // "Team work" (tasks + to-dos of others): Super Admin, HR and TLs.
  const scope = await getTaskScope(user);
  allowed.team = canTrackTeam(scope);
  // "Teach the assistant": Super Admin and HR.
  allowed.assistant = user.isAdmin || user.isHR;
  // Starter questions in the assistant, picked for this person.
  const suggestions = [
    user.isBDE && "How do I log a follow-up on a lead?",
    user.isBDE && "How do I convert a lead into a customer?",
    user.isHR && "How do I generate payroll for the month?",
    user.isHR && "How do I approve a leave request?",
    user.isAdmin && "How do I give someone access to Invoices?",
    scope.kind === "team" && "How do I see my team's tasks and to-dos?",
    allowed.tasks && "How do I schedule a task and assign it?",
    "How do I apply for leave?",
    "How do I check in for attendance?",
    "What should I do today?",
  ].filter((s): s is string => !!s).slice(0, 4);
  const [openTickets, officeReports, inbox, bannerRows, pendingLeave] = await Promise.all([
    allowed.tickets ? db.ticket.count({ where: { status: "OPEN" } }) : 0,
    // Super Admin: months HR has submitted and that are waiting for review.
    user.isAdmin ? db.officeExpenseReport.count({ where: { status: "SUBMITTED" } }) : 0,
    inboxFor(user),
    db.announcement.findMany({ where: unreadWhere(user), orderBy: announcementOrder, take: BANNER_MAX, include: { createdBy: { select: { firstName: true, lastName: true } } } }),
    // HR / Super Admin: leave requests waiting for approval.
    allowed.hr ? db.leaveRequest.count({ where: { status: "PENDING" } }) : 0,
  ]);
  const from = (a: { createdBy: { firstName: string; lastName: string } | null }) => (a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}`.trim() : "Admin");
  const toItem = (a: (typeof inbox.items)[number] | (typeof bannerRows)[number], read: boolean): InboxItem => ({
    id: a.id,
    title: a.title,
    message: a.message,
    urgent: a.urgent,
    pinned: a.pinned,
    createdAt: a.createdAt,
    read,
    from: from(a),
  });

  return (
    <div className="min-h-screen">
      <Sidebar allowed={allowed} isAdmin={user.isAdmin} badges={{ tickets: openTickets, announcements: inbox.unread, officeReports, leave: pendingLeave }} />
      <div className="lg:pl-64">
        <Topbar
          name={`${user.firstName} ${user.lastName}`}
          role={user.isAdmin ? "Super Admin" : user.memberships[0] ? membershipLabel(user.memberships[0]) : user.roleName ?? "Staff"}
          inbox={{ items: inbox.items.map((a) => toItem(a, a.read)), unread: inbox.unread }}
        />
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <AnnouncementBanner items={bannerRows.map((a) => toItem(a, false))} more={Math.max(0, inbox.unread - bannerRows.length)} />
          {children}
        </main>
      </div>
      <AssistantWidget firstName={user.firstName} suggestions={suggestions} canTeach={allowed.assistant} />
    </div>
  );
}
