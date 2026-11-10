"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/client";
import { requestPasswordReset } from "../actions";

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  if (state?.email)
    return state.sent ? (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        We&apos;ve emailed a reset link to <b>{state.email}</b>. It works for 60 minutes. Check your spam folder if you don&apos;t see it.
      </div>
    ) : (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Your request has been sent to HR. We couldn&apos;t email a link to <b>{state.email}</b>, so ask HR or a Super Admin to set a new password for you.
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{state.error}</div>}
      <label className="block">
        <span className="label">Email address</span>
        <input name="email" type="email" required autoComplete="email" autoFocus className="input" placeholder="you@squareit.in" />
      </label>
      <SubmitButton className="w-full py-2.5">Send reset link</SubmitButton>
    </form>
  );
}
