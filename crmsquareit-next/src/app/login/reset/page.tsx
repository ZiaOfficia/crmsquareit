import Link from "next/link";
import { db } from "@/lib/db";
import { hashToken, MIN_PASSWORD } from "@/lib/passwords";
import { ActionForm, SubmitButton } from "@/components/client";
import { resetPassword } from "../actions";
import { AuthShell } from "../shell";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const reset = token ? await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { staff: true } }) : null;
  const valid = !!reset && !reset.usedAt && reset.expiresAt > new Date() && reset.staff.active;
  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-ink">Set a new password</h1>
      {valid && token ? (
        <>
          <p className="mb-6 mt-1 text-sm text-slate-500">For <b>{reset.staff.email}</b></p>
          <ActionForm action={resetPassword.bind(null, token)} className="space-y-4">
            <label className="block">
              <span className="label">New password</span>
              <input name="password" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" autoFocus className="input" />
              <span className="mt-1 block text-xs text-slate-400">At least {MIN_PASSWORD} characters</span>
            </label>
            <label className="block">
              <span className="label">Confirm new password</span>
              <input name="confirm" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" className="input" />
            </label>
            <SubmitButton className="w-full py-2.5">Save password</SubmitButton>
          </ActionForm>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          This reset link is invalid or has expired.{" "}
          <Link href="/login/forgot" className="font-medium underline">Request a new one</Link>.
        </div>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-primary hover:underline">← Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
