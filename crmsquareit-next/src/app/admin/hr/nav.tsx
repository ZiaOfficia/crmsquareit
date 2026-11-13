"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { href: "/admin/hr", label: "Today" },
  { href: "/admin/hr/attendance", label: "Attendance" },
  { href: "/admin/hr/leave", label: "Leave" },
  { href: "/admin/hr/payroll", label: "Payroll" },
  { href: "/admin/hr/employees", label: "Employees" },
  { href: "/admin/hr/holidays", label: "Holidays" },
  { href: "/admin/hr/settings", label: "HR settings" },
];

export function HrNav({ pending }: { pending: number }) {
  const path = usePathname();
  const on = (href: string) => (href === "/admin/hr" ? path === href : path.startsWith(href));
  return (
    <div className="no-print mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={clsx(
            "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition",
            on(t.href) ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          {t.label}
          {t.href === "/admin/hr/leave" && pending > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{pending}</span>}
        </Link>
      ))}
    </div>
  );
}
