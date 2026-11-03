import Link from "next/link";
import { PAGE_SIZE } from "@/lib/constants";

export function Pagination({ total, page, params }: { total: number; page: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{total} record{total === 1 ? "" : "s"}</div>;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") q.set(k, v);
    q.set("page", String(p));
    return `?${q.toString()}`;
  };
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
      <span>
        {total} records · page {page} of {pages}
      </span>
      <div className="flex gap-1">
        {page > 1 && <Link className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50" href={href(page - 1)}>Prev</Link>}
        {page < pages && <Link className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50" href={href(page + 1)}>Next</Link>}
      </div>
    </div>
  );
}

export function pageArgs(page?: string) {
  const p = Math.max(1, parseInt(page || "1", 10) || 1);
  return { page: p, skip: (p - 1) * PAGE_SIZE, take: PAGE_SIZE };
}
