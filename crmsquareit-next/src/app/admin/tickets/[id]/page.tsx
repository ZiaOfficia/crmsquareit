import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { PRIORITY, TICKET_STATUS } from "@/lib/constants";
import { Avatar, Card, DetailRow, Field, PageHeader, StatusBadge, btn } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/client";
import { deleteTicket, replyTicket, updateTicketMeta } from "../actions";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("tickets");
  const { id } = await params;
  const t = await db.ticket.findUnique({
    where: { id: Number(id) },
    include: { customer: true, contact: true, department: true, assigned: true, project: true, replies: { orderBy: { createdAt: "asc" }, include: { staff: true } } },
  });
  if (!t) notFound();
  const [depts, staff] = await Promise.all([db.department.findMany(), db.staff.findMany({ where: { active: true } })]);
  const canEdit = can(user, "tickets", "edit");
  const from = t.contact ? `${t.contact.firstName} ${t.contact.lastName}` : t.name || "Customer";

  return (
    <>
      <PageHeader
        title={<>#{t.id} · {t.subject}</>}
        subtitle={t.customer ? <Link className="link" href={`/admin/customers/${t.customer.id}`}>{t.customer.company}</Link> : t.email}
        back={{ href: "/admin/tickets", label: "Support" }}
        actions={<><StatusBadge map={TICKET_STATUS} value={t.status} /><StatusBadge map={PRIORITY} value={t.priority} />{can(user, "tickets", "delete") && <ConfirmButton action={deleteTicket} hidden={{ id: t.id }} />}</>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={from} />
              <div><p className="text-sm font-semibold">{from}</p><p className="text-xs text-slate-500">{fmtDateTime(t.createdAt)}</p></div>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{t.message}</p>
          </div>
          {t.replies.map((r) => {
            const name = r.staff ? `${r.staff.firstName} ${r.staff.lastName}` : r.fromName || from;
            return (
              <div key={r.id} className={`card p-5 ${r.staff ? "ml-6 border-l-4 border-l-brand-blue" : ""}`}>
                <div className="mb-3 flex items-center gap-3">
                  <Avatar name={name} size={30} />
                  <div><p className="text-sm font-semibold">{name} {r.staff && <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">Staff</span>}</p><p className="text-xs text-slate-500">{fmtDateTime(r.createdAt)}</p></div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{r.message}</p>
              </div>
            );
          })}
          {canEdit && (
            <Card title="Reply">
              <ActionForm action={replyTicket.bind(null, t.id)} resetOnSuccess className="space-y-3 p-5">
                <textarea name="message" rows={5} required className="input" placeholder="Type your reply…" />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-xs text-slate-500">Set status to</span>
                  <select name="status" defaultValue="ANSWERED" className="input w-auto">
                    {Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <SubmitButton>Send reply</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Ticket info">
            <dl className="divide-y divide-slate-100 px-5">
              <DetailRow label="Contact">{t.contact ? `${t.contact.firstName} ${t.contact.lastName}` : t.name}</DetailRow>
              <DetailRow label="Email">{t.contact?.email ?? t.email}</DetailRow>
              <DetailRow label="Project">{t.project && <Link className="link" href={`/admin/projects/${t.project.id}`}>{t.project.name}</Link>}</DetailRow>
              <DetailRow label="Opened">{fmtDateTime(t.createdAt)}</DetailRow>
              <DetailRow label="Last reply">{t.lastReply ? fmtDateTime(t.lastReply) : null}</DetailRow>
            </dl>
          </Card>
          {canEdit && (
            <Card title="Settings">
              <form action={updateTicketMeta} className="space-y-3 p-5">
                <input type="hidden" name="id" value={t.id} />
                <Field label="Status"><select name="status" defaultValue={t.status} className="input">{Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
                <Field label="Priority"><select name="priority" defaultValue={t.priority} className="input">{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
                <Field label="Department"><select name="departmentId" defaultValue={t.departmentId ?? ""} className="input"><option value="">—</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
                <Field label="Assigned to"><select name="assignedId" defaultValue={t.assignedId ?? ""} className="input"><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}</select></Field>
                <button className={btn("primary", "w-full")}>Update</button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
