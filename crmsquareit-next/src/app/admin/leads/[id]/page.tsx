import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, money, timeAgo } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Badge, ButtonLink, Card, DetailRow, PageHeader, btn } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { Notes } from "@/components/notes";
import { convertLead, deleteLead, setLeadFlag, touchLead } from "../actions";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("leads");
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id: Number(id) }, include: { status: true, source: true, assigned: true, customer: true } });
  if (!lead) notFound();
  const { currency } = await getSettings();
  const activity = await db.activity.findMany({ where: { relType: "lead", relId: lead.id }, orderBy: { createdAt: "desc" }, take: 20, include: { staff: true } });
  const canEdit = can(user, "leads", "edit");

  return (
    <>
      <PageHeader
        title={lead.name}
        subtitle={[lead.title, lead.company].filter(Boolean).join(" at ")}
        back={{ href: "/admin/leads", label: "Leads" }}
        actions={
          <>
            <Badge color={lead.status.color}>{lead.status.name}</Badge>
            {lead.lost && <Badge tone="red">Lost</Badge>}
            {lead.junk && <Badge tone="gray">Junk</Badge>}
            {lead.customer ? (
              <ButtonLink variant="success" href={`/admin/customers/${lead.customer.id}`}>View customer</ButtonLink>
            ) : (
              can(user, "customers", "create") && (
                <form action={convertLead}>
                  <input type="hidden" name="id" value={lead.id} />
                  <button className={btn("success")}>Convert to customer</button>
                </form>
              )
            )}
            {canEdit && <ButtonLink variant="secondary" href={`/admin/leads/${lead.id}/edit`}>Edit</ButtonLink>}
            {can(user, "leads", "delete") && <ConfirmButton action={deleteLead} hidden={{ id: lead.id }} />}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Lead information">
            <dl className="divide-y divide-slate-100 px-5">
              <DetailRow label="Email">{lead.email && <a className="link" href={`mailto:${lead.email}`}>{lead.email}</a>}</DetailRow>
              <DetailRow label="Phone">{lead.phone && <a className="link" href={`tel:${lead.phone}`}>{lead.phone}</a>}</DetailRow>
              <DetailRow label="Website">{lead.website}</DetailRow>
              <DetailRow label="Value">{lead.value ? money(lead.value, currency) : null}</DetailRow>
              <DetailRow label="Source">{lead.source?.name}</DetailRow>
              <DetailRow label="Assigned">{lead.assigned ? `${lead.assigned.firstName} ${lead.assigned.lastName}` : null}</DetailRow>
              <DetailRow label="City">{[lead.city, lead.country].filter(Boolean).join(", ")}</DetailRow>
              <DetailRow label="Address">{lead.address}</DetailRow>
              <DetailRow label="Created">{fmtDate(lead.createdAt)}</DetailRow>
              <DetailRow label="Last contact">{lead.lastContact ? fmtDateTime(lead.lastContact) : null}</DetailRow>
            </dl>
            {lead.description && <p className="whitespace-pre-wrap border-t border-slate-100 px-5 py-4 text-sm text-slate-600">{lead.description}</p>}
          </Card>
          {canEdit && (
            <Card title="Quick actions">
              <div className="flex flex-wrap gap-2 p-4">
                <form action={touchLead}>
                  <input type="hidden" name="id" value={lead.id} />
                  <button className={btn("secondary")}>Log contact now</button>
                </form>
                {(["lost", "junk"] as const).map((flag) => (
                  <form key={flag} action={setLeadFlag}>
                    <input type="hidden" name="id" value={lead.id} />
                    <input type="hidden" name="flag" value={flag} />
                    <input type="hidden" name="value" value={lead[flag] ? "0" : "1"} />
                    <button className={btn("secondary")}>{lead[flag] ? `Unmark ${flag}` : `Mark as ${flag}`}</button>
                  </form>
                ))}
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Notes relType="lead" relId={lead.id} path={`/admin/leads/${lead.id}`} />
          <Card title="Activity log">
            <ul className="divide-y divide-slate-100">
              {activity.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No activity yet.</li>}
              {activity.map((a) => (
                <li key={a.id} className="flex justify-between gap-4 px-5 py-3 text-sm">
                  <span><span className="font-medium">{a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : "System"}</span> {a.description}</span>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
          {lead.customer && (
            <p className="text-sm text-slate-500">
              Converted to <Link className="link" href={`/admin/customers/${lead.customer.id}`}>{lead.customer.company}</Link>.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
