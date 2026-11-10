import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { canManageOrg } from "@/lib/org";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/client";
import { StaffForm } from "../form";
import { deleteStaffPermanently, saveStaff, setStaffActive } from "../actions";
import { PasswordReveal } from "../password-reveal";

export default async function EditStaff({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("staff", "edit");
  const { id } = await params;
  const s = await db.staff.findUnique({
    where: { id: Number(id) },
    include: {
      orgMemberships: true,
      _count: { select: { timeEntries: true, todos: true, leads: true, tasks: true, tickets: true, notes: true, quotations: true, projects: true } },
    },
  });
  if (!s) notFound();
  // Super Admin sees everyone's password; HR sees everyone's except Super Admins'.
  const canViewPassword = canManageOrg(user) && (user.isAdmin || !s.isAdmin);
  const openReset = canViewPassword
    ? await db.passwordReset.findFirst({ where: { staffId: s.id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } })
    : null;
  // Deactivate / delete: needs Staff → delete, never yourself, and only a Super Admin can touch a Super Admin.
  const canRemove = can(user, "staff", "delete") && s.id !== user.id && (user.isAdmin || !s.isAdmin);
  // Permanent delete is Super Admin only.
  const canDelete = user.isAdmin && s.id !== user.id;
  const c = s._count;
  const kept = [
    [c.leads, "lead"], [c.tasks, "task"], [c.projects, "project"], [c.tickets, "ticket"], [c.notes, "note"], [c.quotations, "quotation"],
  ].filter(([n]) => (n as number) > 0).map(([n, w]) => `${n} ${w}${n === 1 ? "" : "s"}`);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={<span className="flex items-center gap-3">{s.firstName} {s.lastName} {!s.active && <Badge>Inactive</Badge>}</span>}
        back={{ href: "/admin/staff", label: "Staff" }}
        actions={
          canRemove &&
          (s.active ? (
            <ConfirmButton action={setStaffActive} hidden={{ id: s.id, active: 0 }} label="Deactivate" confirmLabel="Click to deactivate" />
          ) : (
            <form action={setStaffActive}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="active" value="1" />
              <SubmitButton variant="success">Activate</SubmitButton>
            </form>
          ))
        }
      />
      {!s.active && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This account is inactive. {s.firstName} can&apos;t log in, but everything they worked on is kept.
        </div>
      )}
      {canViewPassword && (
        <Card title="Login password" className="mb-6" actions={openReset && <Badge tone="amber">Reset requested {fmtDateTime(openReset.createdAt)}</Badge>}>
          <div className="space-y-2 p-5">
            <PasswordReveal staffId={s.id} />
            <p className="text-xs text-slate-500">
              {s.passwordSetAt ? `Last set ${fmtDateTime(s.passwordSetAt)}. ` : ""}
              Visible to Super Admins and HR only. Each view is recorded in the activity log. To change it, type a new password below.
            </p>
          </div>
        </Card>
      )}
      <StaffForm action={saveStaff.bind(null, s.id)} staff={s} canSetAdmin={user.isAdmin} canSetOrg={user.isAdmin || (canManageOrg(user) && s.id !== user.id && !s.isAdmin)} />

      {canDelete && (
        <Card title={<span className="text-brand-red">Danger zone</span>} className="mt-6 border-red-200">
          <div className="space-y-4 p-5 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-800">Delete from database</p>
              <p className="mt-1">
                Permanently removes {s.firstName} {s.lastName}. This can&apos;t be undone. To just stop them logging in, use <b>Deactivate</b> instead.
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                <li>
                  <b>Deleted with them:</b> {c.timeEntries} time {c.timeEntries === 1 ? "entry" : "entries"}, {c.todos} to-do{c.todos === 1 ? "" : "s"}, department places and password history.
                </li>
                <li>
                  <b>Kept, without their name:</b> {kept.length ? kept.join(", ") : "nothing else is linked to them"}.
                </li>
              </ul>
            </div>
            <ActionForm action={deleteStaffPermanently.bind(null, s.id)} className="space-y-3">
              <label className="block">
                <span className="label">
                  Type <b className="font-mono">{s.email}</b> to confirm
                </span>
                <input name="confirm" required autoComplete="off" spellCheck={false} className="input" />
              </label>
              <SubmitButton variant="danger">Delete permanently</SubmitButton>
            </ActionForm>
          </div>
        </Card>
      )}
    </div>
  );
}
