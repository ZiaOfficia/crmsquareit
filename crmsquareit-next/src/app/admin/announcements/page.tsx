import Link from "next/link";
import clsx from "clsx";
import { Pin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canAnnounce } from "@/lib/org";
import { audienceLabel, composeOptions, listFor, readStats, staffDirectory } from "@/lib/announcements";
import { fmtDate, timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { LiveRefresh } from "@/components/announcements";
import { ComposeForm } from "./compose-form";
import { createAnnouncement } from "./actions";
import { MarkAllReadButton, MarkReadButton } from "./read-button";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const user = await requireUser();
  const { dept } = await searchParams;
  const now = new Date();
  const canSend = canAnnounce(user);
  const [items, options, dir] = await Promise.all([listFor(user), canSend ? composeOptions() : null, canSend ? staffDirectory() : null]);
  const unread = items.filter((a) => !a.read && !a.mine).length;
  const presetDept = Number(dept) || null;

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={canSend ? "Send updates to everyone, to departments or to specific people, and see who has read them." : "Updates from management."}
        actions={
          <>
            {canSend && <LiveRefresh />}
            {unread > 0 && <MarkAllReadButton />}
          </>
        }
      />

      <div className={clsx("grid gap-6", canSend && "xl:grid-cols-5")}>
        {canSend && options && (
          <Card title="New announcement" className="h-fit xl:sticky xl:top-20 xl:col-span-2">
            <div className="p-5">
              <ComposeForm
                action={createAnnouncement}
                departments={options.departments}
                staff={options.staff.filter((s) => s.id !== user.id)}
                initial={presetDept ? { audience: "DEPARTMENTS", departmentIds: [presetDept] } : undefined}
              />
            </div>
          </Card>
        )}

        <div className={clsx("space-y-3", canSend && "xl:col-span-3")}>
          {items.length === 0 && (
            <Card>
              <EmptyState title="No announcements yet" text={canSend ? "Send your first one with the form." : "Announcements from management will appear here."} />
            </Card>
          )}
          {items.map((a) => {
            const expired = !!a.expiresAt && a.expiresAt < now;
            const stats = dir && a.mine ? readStats(a, dir) : null;
            const inbox = !a.mine; // shown to them as a recipient
            const body = (
              <div className={clsx("card p-5 transition", !a.read && inbox && "border-l-4 border-l-primary", a.urgent && !expired && "border-red-200", expired && "opacity-60", a.mine && "hover:shadow-md")}>
                <div className="flex flex-wrap items-center gap-2">
                  {a.pinned && <Pin className="h-4 w-4 text-primary" />}
                  {a.urgent && <Badge tone="red">Urgent</Badge>}
                  {expired && <Badge tone="gray">Expired</Badge>}
                  {!a.read && inbox && <Badge tone="blue">New</Badge>}
                  <h3 className="font-semibold text-slate-800">{a.title}</h3>
                </div>
                <p className={clsx("mt-2 whitespace-pre-line text-sm text-slate-600", a.mine && "line-clamp-3")}>{a.message}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                  <span>
                    {a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}` : "Admin"} · <span title={fmtDate(a.createdAt)}>{timeAgo(a.createdAt)}</span>
                  </span>
                  {a.mine && <span>To: <span className="font-medium text-slate-700">{audienceLabel(a)}</span></span>}
                  {a.expiresAt && !expired && <span>Expires {fmtDate(a.expiresAt)}</span>}
                  {stats && (
                    <span className="ml-auto flex items-center gap-2">
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <span className={clsx("block h-full rounded-full", stats.pct === 100 ? "bg-brand-green" : "bg-primary")} style={{ width: `${stats.pct}%` }} />
                      </span>
                      <span className="font-medium text-slate-700">
                        {stats.read}/{stats.total} read
                      </span>
                    </span>
                  )}
                  {!a.read && inbox && (
                    <span className="ml-auto">
                      <MarkReadButton id={a.id} />
                    </span>
                  )}
                </div>
              </div>
            );
            return a.mine ? (
              <Link key={a.id} href={`/admin/announcements/${a.id}`} className="block">
                {body}
              </Link>
            ) : (
              <div key={a.id}>{body}</div>
            );
          })}
        </div>
      </div>
    </>
  );
}
