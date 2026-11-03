import Link from "next/link";
import { LogOut, Search, Plus } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Avatar } from "./ui";

export function Topbar({ name, role }: { name: string; role: string }) {
  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/85 px-4 pl-16 backdrop-blur sm:px-6 lg:px-8">
      <form action="/admin/search" className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input name="q" placeholder="Search customers, leads, invoices, projects…" className="input border-slate-200 bg-slate-50 pl-9 shadow-none" />
      </form>
      <div className="ml-auto flex items-center gap-3">
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New</span>
          </summary>
          <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {[
              ["/admin/leads/new", "Lead"],
              ["/admin/customers/new", "Customer"],
              ["/admin/invoices/new", "Invoice"],
              ["/admin/estimates/new", "Estimate"],
              ["/admin/projects/new", "Project"],
              ["/admin/tasks/new", "Task"],
              ["/admin/tickets/new", "Ticket"],
              ["/admin/expenses/new", "Expense"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                {label}
              </Link>
            ))}
          </div>
        </details>
        <Link href="/admin/profile" className="flex items-center gap-2.5">
          <Avatar name={name} size={34} />
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-semibold text-slate-800">{name}</span>
            <span className="block text-xs text-slate-500">{role}</span>
          </span>
        </Link>
        <form action={logout}>
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-red" title="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
