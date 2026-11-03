"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import clsx from "clsx";
import {
  LayoutDashboard, Users, Target, FileText, FileSignature, CreditCard, Receipt, FolderKanban,
  CheckSquare, LifeBuoy, BarChart3, UserCog, Settings, Menu, X,
} from "lucide-react";

type Item = { href: string; label: string; icon: React.ElementType; perm?: string; adminOnly?: boolean; badge?: string };
const groups: { title?: string; items: Item[] }[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "CRM",
    items: [
      { href: "/admin/leads", label: "Leads", icon: Target, perm: "leads" },
      { href: "/admin/customers", label: "Customers", icon: Users, perm: "customers" },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/admin/invoices", label: "Invoices", icon: FileText, perm: "invoices" },
      { href: "/admin/estimates", label: "Estimates", icon: FileSignature, perm: "estimates" },
      { href: "/admin/payments", label: "Payments", icon: CreditCard, perm: "payments" },
      { href: "/admin/expenses", label: "Expenses", icon: Receipt, perm: "expenses" },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/admin/projects", label: "Projects", icon: FolderKanban, perm: "projects" },
      { href: "/admin/tasks", label: "Tasks", icon: CheckSquare, perm: "tasks" },
      { href: "/admin/tickets", label: "Support", icon: LifeBuoy, perm: "tickets", badge: "tickets" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3, perm: "reports" },
      { href: "/admin/staff", label: "Staff & roles", icon: UserCog, perm: "staff" },
      { href: "/admin/settings", label: "Settings", icon: Settings, perm: "settings" },
    ],
  },
];

export function Sidebar({ allowed, isAdmin, badges }: { allowed: Record<string, boolean>; isAdmin: boolean; badges: Record<string, number> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((g, gi) => {
        const items = g.items.filter((i) => (!i.perm || allowed[i.perm]) && (!i.adminOnly || isAdmin));
        if (!items.length) return null;
        return (
          <div key={gi}>
            {g.title && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{g.title}</p>}
            <div className="space-y-0.5">
              {items.map((i) => {
                const active = isActive(i.href);
                const count = i.badge ? badges[i.badge] : 0;
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    className={clsx(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    )}
                  >
                    <i.icon className={clsx("h-4 w-4", active ? "text-brand-yellow" : "text-slate-500 group-hover:text-slate-300")} />
                    <span className="flex-1">{i.label}</span>
                    {count > 0 && <span className="rounded-full bg-brand-red px-1.5 text-[10px] font-bold text-white">{count}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print fixed left-3 top-3 z-40 rounded-lg bg-sidebar p-2 text-white lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={clsx(
          "no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
          <Link href="/admin">
            <img src="/logo.png" alt="Squareit" className="h-12" />
          </Link>
          <button onClick={() => setOpen(false)} className="text-slate-400 lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        {nav}
        <div className="flex h-1">
          <span className="flex-1 bg-brand-green" />
          <span className="flex-1 bg-brand-red" />
          <span className="flex-1 bg-brand-blue" />
          <span className="flex-1 bg-brand-yellow" />
        </div>
      </aside>
    </>
  );
}
