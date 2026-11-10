import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import clsx from "clsx";
import { Pencil, Pin, PinOff } from "lucide-react";
import { requireAdminOrHR } from "@/lib/auth";
import { db } from "@/lib/db";
import { audienceLabel, composeOptions, resolveAudience, staffDirectory } from "@/lib/announcements";
import { fmtDate, fmtDateTime, inputDate, timeAgo } from "@/lib/format";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader, btn } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { LiveRefresh } from "@/components/announcements";
import { ComposeForm } from "../compose-form";
import { deleteAnnouncement, togglePin, updateAnnouncement } from "../actions";

export const metadata = { title: "Announcement" };

export default async function AnnouncementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const user = await requireAdminOrHR();
  const { id: rawId } = await params;
  const { edit } = await searchParams;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const [a, dir] = await Promise.all([
    db.announcement.findUnique({
      where: { id },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        departments: { select: { id: true, name: true } },
        recipients: { select: { id: true, firstName: true, lastName: true } },
        reads: { select: { staffId: true, readAt: true } },
      },
    }),
    staffDirectory(),
  ]);
  if (!a) notFound();
  // HR can open (and manage) only the announcements they sent.
  if (!user.isAdmin && a.createdById !== user.id) redirect("/admin/forbidden");

  const audience = resolveAudience(a, dir);
  const readAt = new Map(a.reads.map((r) => [r.staffId, r.readAt]));
  const readers = audience.filter((s) => readAt.has(s.id)).sort((x, y) => readAt.get(y.id)!.getTime() - readAt.get(x.id)!.getTime());
  const pending = audience.filter((s) => !readAt.has(s.id));
  const pct = audience.length ? Math.round((readers.length / audience.length) * 100) : 0;
  const expired = !!a.expiresAt && a.expiresAt < new Date();
  const options = edit ? await composeOptions() : null;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/announcements", label: "Announcements" }}
        title={a.title}
        subtitle={`Sent by ${a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}` : "Admin"} · ${fmtDateTime(a.createdAt)}${a.updatedAt.getTime() - a.createdAt.getTime() > 5000 ? ` · edited ${timeAgo(a.updatedAt)}` : ""}`}
        actions={
          <>
            <LiveRefresh />
            <form action={togglePin}>
              <input type="hidden" name="id" value={a.id} />
              <button className={btn("secondary")}>{a.pinned ? <><PinOff className="h-4 w-4" /> Unpin</> : <><Pin className="h-4 w-4" /> Pin</>}</button>
            </form>
            {!edit && (
              <ButtonLink href={`/admin/announcements/${a.id}?edit=1`} variant="secondary">
                <Pencil className="h-4 w-4" /> Edit
              </ButtonLink>
            )}
            <ConfirmButton action={deleteAnnouncement} hidden={{ id: a.id }} label="Delete" confirmLabel="Delete for everyone?" />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {options ? (
            <Card title="Edit announcement" actions={<Link href={`/admin/announcements/${a.id}`} className="link text-xs">Cancel</Link>}>
              <div className="p-5">
                <ComposeForm
                  action={updateAnnouncement.bind(null, a.id)}
                  departments={options.departments}
                  staff={options.staff.filter((s) => s.id !== a.createdById)}
                  submitLabel="Save changes"
                  initial={{
                    title: a.title,
                    message: a.message,
                    audience: a.audience as "ALL" | "DEPARTMENTS" | "PEOPLE",
                    departmentIds: a.departments.map((d) => d.id),
                    staffIds: a.recipients.map((r) => r.id),
                    urgent: a.urgent,
                    pinned: a.pinned,
                    expiresAt: inputDate(a.expiresAt),
                  }}
                />
                <p className="mt-3 text-xs text-slate-400">People who already read it stay marked as read.</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  {a.urgent && <Badge tone="red">Urgent</Badge>}
                  {a.pinned && <Badge tone="blue">Pinned</Badge>}
                  {expired ? <Badge tone="gray">Expired {fmtDate(a.expiresAt)}</Badge> : a.expiresAt && <Badge tone="amber">Expires {fmtDate(a.expiresAt)}</Badge>}
                  <Badge tone="purple">To: {audienceLabel(a)}</Badge>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{a.message}</p>
              </div>
            </Card>
          )}

          <Card title={`Not read yet (${pending.length})`}>
            {pending.length === 0 ? (
              <EmptyState title={audience.length ? "Everyone has read it 🎉" : "Nobody is in this audience"} text={audience.length ? undefined : "The selected departments have no active members yet."} />
            ) : (
              <PeopleList people={pending.map((s) => ({ ...s, note: s.lastLogin ? `Last login ${timeAgo(s.lastLogin)}` : "Never logged in" }))} />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Read receipts</p>
              <p className="mt-2 text-4xl font-bold text-ink">{pct}%</p>
              <p className="mt-1 text-sm text-slate-500">
                {readers.length} of {audience.length} people
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={clsx("h-full rounded-full", pct === 100 ? "bg-brand-green" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </Card>
          <Card title={`Read (${readers.length})`}>
            {readers.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">No one yet.</p>
            ) : (
              <PeopleList people={readers.map((s) => ({ ...s, note: timeAgo(readAt.get(s.id)!) }))} />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function PeopleList({ people }: { people: { id: number; name: string; placement: string; note: string }[] }) {
  return (
    <ul className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
      {people.map((s) => (
        <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
          <Avatar name={s.name} size={30} />
          <div className="min-w-0 flex-1">
            <Link href={`/admin/staff/${s.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-primary">
              {s.name}
            </Link>
            <p className="truncate text-xs text-slate-500">{s.placement}</p>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{s.note}</span>
        </li>
      ))}
    </ul>
  );
}
