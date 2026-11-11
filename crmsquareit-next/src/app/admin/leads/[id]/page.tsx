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
import { docNumber } from "@/lib/sales";
import { FollowUpForm, LeadJourney, StageButtons } from "@/components/lead-flow";
import { FOLLOW_UP_CHANNELS, STAGE_INFO, stageInclude, stageOf } from "@/lib/lead-flow";
import { convertLead, deleteLead, setLeadFlag, touchLead } from "../actions";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("leads");
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id: Number(id) }, include: {
      status: true,
      source: true,
      assigned: true,
      customer: true,
      ...stageInclude,
      followUps: { orderBy: { createdAt: "desc" }, include: { staff: { select: { firstName: true, lastName: true } } } },
      quotations: { orderBy: { date: "desc" }, select: { id: true, prefix: true, number: true, status: true, total: true, currency: true, date: true } },
    },
  });
  if (!lead) notFound();
  const { currency } = await getSettings();
  const activity = await db.activity.findMany({ where: { relType: "lead", relId: lead.id }, orderBy: { createdAt: "desc" }, take: 20, include: { staff: true } });
  const canEdit = can(user, "leads", "edit");
  const stage = stageOf(lead);
  const info = STAGE_INFO[stage];

  return (
    <>
      <PageHeader
        title={lead.name}
        subtitle={[lead.title, lead.company].filter(Boolean).join(" at ")}
        back={{ href: "/admin/leads", label: "Leads" }}
        actions={
          <>
            <Badge color={info.color}>{info.label}</Badge>
            <Badge color={lead.status.color}>{lead.status.name}</Badge>
            {lead.lost && <Badge tone="red">Lost</Badge>}
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
            {can(user, "quotations", "create") && <ButtonLink variant="secondary" href={`/admin/quotations/new?leadId=${lead.id}`}>New quotation</ButtonLink>}
            {canEdit && <ButtonLink variant="secondary" href={`/admin/leads/${lead.id}/edit`}>Edit</ButtonLink>}
            {can(user, "leads", "delete") && <ConfirmButton action={deleteLead} hidden={{ id: lead.id }} />}
          </>
        }
      />
      <Card
        className="mb-6"
        title="Lead journey"
        actions={<span className="text-xs text-slate-500">Next step: <span className="font-semibold text-slate-700">{info.next}</span></span>}
      >
        <LeadJourney stage={stage} />
        {stage === "NEW" && can(user, "quotations", "create") && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
            {lead.quotations.length ? "A draft quotation exists — mark it as sent once the client has it." : "Start by sending this lead a quotation."}
            <ButtonLink href={lead.quotations[0] ? `/admin/quotations/${lead.quotations[0].id}` : `/admin/quotations/new?leadId=${lead.id}`}>
              {lead.quotations.length ? "Open quotation" : "Create quotation"}
            </ButtonLink>
          </div>
        )}
        {stage === "HOT" && can(user, "customers", "create") && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
            This lead is hot — convert it once the client confirms.
            <form action={convertLead}>
              <input type="hidden" name="id" value={lead.id} />
              <button className={btn("success")}>Convert to customer</button>
            </form>
          </div>
        )}
      </Card>
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
              <DetailRow label="Next follow-up">{lead.nextFollowUp ? fmtDate(lead.nextFollowUp) : null}</DetailRow>
            </dl>
            {lead.description && <p className="whitespace-pre-wrap border-t border-slate-100 px-5 py-4 text-sm text-slate-600">{lead.description}</p>}
          </Card>
          {canEdit && (
            <Card title="Quick actions">
              <div className="space-y-3 p-4">
                {stage !== "CUSTOMER" && (
                  <div>
                    <p className="label">Sort this lead</p>
                    <StageButtons id={lead.id} stage={stage} />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
                <form action={touchLead}>
                  <input type="hidden" name="id" value={lead.id} />
                  <button className={btn("secondary")}>Log contact now</button>
                </form>
                {(["lost"] as const).map((flag) => (
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
          {lead.quotations.length > 0 && (
            <Card title={`Quotations (${lead.quotations.length})`}>
              <ul className="divide-y divide-slate-100">
                {lead.quotations.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <Link href={`/admin/quotations/${q.id}`} className="font-medium text-slate-800 hover:text-primary">
                      {docNumber(q.prefix, q.number)} · {fmtDate(q.date)}
                    </Link>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums">{money(q.total, q.currency)}</span>
                      <Badge tone={q.status === "ACCEPTED" ? "green" : q.status === "DECLINED" ? "red" : q.status === "SENT" ? "blue" : "gray"}>{q.status.toLowerCase()}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title={`Follow-ups (${lead.followUps.length})`}>
            <div id="follow-up" />
            {canEdit && stage !== "CUSTOMER" && <FollowUpForm leadId={lead.id} nextFollowUp={lead.nextFollowUp} />}
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {lead.followUps.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No follow-ups logged yet.</li>}
              {lead.followUps.map((fu) => (
                <li key={fu.id} className="px-5 py-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone="gray">{FOLLOW_UP_CHANNELS[fu.channel] ?? fu.channel}</Badge>
                    {fu.outcome && <Badge color={STAGE_INFO[fu.outcome as "HOT" | "COLD" | "JUNK"]?.color}>{STAGE_INFO[fu.outcome as "HOT" | "COLD" | "JUNK"]?.label ?? fu.outcome}</Badge>}
                    <span className="font-semibold text-slate-700">{fu.staff ? `${fu.staff.firstName} ${fu.staff.lastName}` : "—"}</span>
                    <span>· {fmtDateTime(fu.createdAt)}</span>
                    {fu.nextDate && <span>· next on {fmtDate(fu.nextDate)}</span>}
                  </p>
                  {fu.note && <p className="mt-1 whitespace-pre-wrap text-slate-700">{fu.note}</p>}
                </li>
              ))}
            </ul>
          </Card>
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
