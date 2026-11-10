import Link from "next/link";
import { AuthShell } from "../shell";
import { ForgotForm } from "./form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-ink">Forgot password</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Enter your work email and we&apos;ll send you a link to set a new password.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-primary hover:underline">← Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
