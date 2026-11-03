import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field, PageHeader } from "@/components/ui";
import { changePassword, updateProfile } from "./actions";

export const metadata = { title: "My profile" };
export default async function Profile() {
  const user = await requireUser();
  const s = (await db.staff.findUnique({ where: { id: user.id } }))!;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="My profile" subtitle={`${s.email} · ${user.roleName ?? "Staff"}`} />
      <ActionForm action={updateProfile} savedText="Profile updated.">
        <Card title="Details">
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="First name"><input name="firstName" defaultValue={s.firstName} className="input" /></Field>
            <Field label="Last name"><input name="lastName" defaultValue={s.lastName} className="input" /></Field>
            <Field label="Phone"><input name="phone" defaultValue={s.phone ?? ""} className="input" /></Field>
          </div>
          <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>Save</SubmitButton></div>
        </Card>
      </ActionForm>
      <ActionForm action={changePassword} savedText="Password changed." resetOnSuccess>
        <Card title="Change password">
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Current password"><input name="current" type="password" required className="input" /></Field>
            <Field label="New password"><input name="password" type="password" required minLength={6} className="input" /></Field>
            <Field label="Confirm new password"><input name="confirm" type="password" required className="input" /></Field>
          </div>
          <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>Change password</SubmitButton></div>
        </Card>
      </ActionForm>
    </div>
  );
}
