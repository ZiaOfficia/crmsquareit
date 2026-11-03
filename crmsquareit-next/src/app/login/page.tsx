import { ActionForm, SubmitButton } from "@/components/client";
import { login } from "./actions";

export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
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
          <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">Sign in to the admin panel</p>
          <ActionForm action={login} className="space-y-4">
            <input type="hidden" name="next" value={next ?? ""} />
            <label className="block">
              <span className="label">Email</span>
              <input name="email" type="email" required autoComplete="email" className="input" placeholder="you@squareit.in" />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <input name="password" type="password" required autoComplete="current-password" className="input" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="remember" className="rounded" /> Remember me
            </label>
            <SubmitButton className="w-full py-2.5">Sign in</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
