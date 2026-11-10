import type { ReactNode } from "react";

/** Branded two-column layout shared by login, forgot and reset password. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <img src="/logo.png" alt="Squareit" className="w-56" />
        <div className="relative z-10">
          <h2 className="text-4xl font-bold leading-tight text-white">
            Your clients, projects
            <br />
            and billing — <span className="text-brand-yellow">in one place.</span>
          </h2>
          <p className="mt-4 max-w-md text-slate-400">Leads, customers, invoices, projects, tasks and support, rebuilt for speed.</p>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Squareit · Say Digital, Way Digital</p>
        <div className="pointer-events-none absolute -right-20 -top-16 grid grid-cols-2 gap-6 opacity-15">
          <span className="h-40 w-40 rounded-2xl border-[14px] border-brand-green" />
          <span className="h-40 w-40 rounded-2xl border-[14px] border-brand-red" />
          <span className="h-40 w-40 rounded-2xl border-[14px] border-brand-blue" />
          <span className="h-40 w-40 rounded-2xl border-[14px] border-brand-yellow" />
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 rounded-xl bg-sidebar p-4 lg:hidden">
            <img src="/logo.png" alt="Squareit" className="mx-auto w-44" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
