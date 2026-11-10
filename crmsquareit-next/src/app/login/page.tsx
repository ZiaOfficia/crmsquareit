import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/client";
import { login } from "./actions";
import { AuthShell } from "./shell";

export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Sign in to the admin panel</p>
      {reset && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">Password changed. Sign in with your new password.</div>}
      <ActionForm action={login} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" className="input" placeholder="you@squareit.in" />
        </label>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="label">Password</label>
            <Link href="/login/forgot" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
          </div>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="remember" className="rounded" /> Remember me
        </label>
        <SubmitButton className="w-full py-2.5">Sign in</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
