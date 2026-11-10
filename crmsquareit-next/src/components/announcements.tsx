"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Bell, Check, CheckCheck, Megaphone, Pin } from "lucide-react";
import { markAllRead, markRead } from "@/app/admin/announcements/actions";
import { timeAgo } from "@/lib/format";

export type InboxItem = { id: number; title: string; message: string; urgent: boolean; pinned: boolean; createdAt: Date; read: boolean; from: string };

/** Bell in the top bar: unread count + latest announcements. */
export function AnnouncementBell({ items, unread }: { items: InboxItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label={`Announcements, ${unread} unread`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-brand-red px-1 text-center text-[10px] font-bold leading-[18px] text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Announcements</p>
            {unread > 0 && (
              <button disabled={pending} onClick={() => start(() => markAllRead())} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No announcements yet.</li>}
            {items.map((a) => (
              <li key={a.id} className={clsx("flex gap-3 px-4 py-3", !a.read && "bg-blue-50/50")}>
                <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.read ? "bg-transparent" : a.urgent ? "bg-brand-red" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    {a.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                    {a.urgent && <span className="rounded bg-red-100 px-1 text-[10px] font-bold uppercase text-red-700">Urgent</span>}
                    <span className="truncate">{a.title}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{a.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {a.from} · {timeAgo(new Date(a.createdAt))}
                  </p>
                </div>
                {!a.read && (
                  <button onClick={() => start(() => markRead(a.id))} title="Mark as read" className="self-start rounded p-1 text-slate-400 hover:bg-white hover:text-brand-green">
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Link href="/admin/announcements" onClick={() => setOpen(false)} className="block border-t border-slate-100 py-2.5 text-center text-xs font-semibold text-primary hover:bg-slate-50">
            View all announcements
          </Link>
        </div>
      )}
    </div>
  );
}

/** Unread announcements shown above every page until the person clicks "Got it". */
export function AnnouncementBanner({ items, more }: { items: InboxItem[]; more: number }) {
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const shown = items.filter((a) => !hidden.has(a.id));
  if (!shown.length) return null;
  return (
    <div className="no-print mb-5 space-y-2">
      {shown.map((a) => (
        <div
          key={a.id}
          className={clsx(
            "flex items-start gap-3 rounded-xl border px-4 py-3",
            a.urgent ? "border-red-200 bg-red-50 text-red-900" : "border-blue-200 bg-blue-50 text-blue-950"
          )}
        >
          <Megaphone className={clsx("mt-0.5 h-5 w-5 shrink-0", a.urgent ? "text-brand-red" : "text-primary")} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {a.urgent && "Urgent: "}
              {a.title}
            </p>
            <p className="mt-0.5 whitespace-pre-line text-sm opacity-90">{a.message}</p>
            <p className="mt-1 text-xs opacity-60">
              {a.from} · {timeAgo(new Date(a.createdAt))}
            </p>
          </div>
          <button
            disabled={pending}
            onClick={() => {
              setHidden((h) => new Set(h).add(a.id));
              start(() => markRead(a.id));
            }}
            className={clsx(
              "flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
              a.urgent ? "bg-brand-red text-white hover:bg-red-600" : "bg-primary text-white hover:bg-primary-dark"
            )}
          >
            <Check className="h-3.5 w-3.5" /> Got it
          </button>
        </div>
      ))}
      {more > 0 && (
        <Link href="/admin/announcements" className="flex items-center gap-1 px-1 text-xs font-medium text-primary hover:underline">
          +{more} more unread announcement{more === 1 ? "" : "s"} →
        </Link>
      )}
    </div>
  );
}

/** Re-fetches the page's server data every few seconds while the tab is visible
 *  (and right away when you come back to the tab), so the panel stays live. */
export function LiveRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      router.refresh();
      setAt(Date.now());
    };
    const run = () => {
      clearInterval(t);
      if (document.visibilityState !== "visible") return;
      if (Date.now() - at > seconds * 1000) tick();
      t = setInterval(tick, seconds * 1000);
    };
    run();
    document.addEventListener("visibilitychange", run);
    const clock = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      clearInterval(t);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, seconds]);
  const ago = Math.max(0, Math.round((now - at) / 1000));
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200" title={`Refreshes every ${seconds}s`}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      Live · {ago < 5 ? "just now" : `${ago}s ago`}
    </span>
  );
}
