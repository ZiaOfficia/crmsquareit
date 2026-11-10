import type { OfficeExpense } from "@prisma/client";
import { db } from "@/lib/db";
import { inputDate } from "@/lib/format";
import type { ActionState } from "@/lib/forms";
import { OFFICE_EXPENSE_CATEGORIES } from "@/lib/office-expenses";
import { ActionForm, SubmitButton } from "@/components/client";
import { Field } from "@/components/ui";

const DEFAULT_MODES = ["Cash", "UPI", "Bank transfer", "Card", "Cheque"];

/** Used inline on the month page (new) and on the edit page. */
export async function OfficeExpenseForm({ action, expense, defaultDate, compact }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; expense?: OfficeExpense; defaultDate?: Date; compact?: boolean }) {
  const modes = await db.paymentMode.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const modeNames = [...new Set([...DEFAULT_MODES, ...modes.map((m) => m.name)])];
  const e = expense;
  const cols = compact ? "" : "sm:grid-cols-2";
  return (
    <ActionForm action={action} resetOnSuccess={!e} savedText={e ? undefined : "Expense added."}>
      <div className={`grid gap-4 ${cols}`}>
        <Field label="What was it for? *" className={compact ? "" : "sm:col-span-2"}>
          <input name="title" required maxLength={160} defaultValue={e?.title} placeholder="e.g. Office rent, tea & snacks, printer ink" className="input" />
        </Field>
        <Field label="Category *">
          <select name="category" required defaultValue={e?.category ?? ""} className="input">
            <option value="" disabled>Choose…</option>
            {OFFICE_EXPENSE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount *"><input name="amount" type="number" step="0.01" min="0.01" required defaultValue={e?.amount} className="input" /></Field>
          <Field label="Date *"><input name="date" type="date" required defaultValue={inputDate(e?.date ?? defaultDate ?? new Date())} className="input" /></Field>
        </div>
        <Field label="Paid to"><input name="paidTo" defaultValue={e?.paidTo ?? ""} placeholder="Vendor, shop or person" className="input" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Paid by">
            <select name="paymentMode" defaultValue={e?.paymentMode ?? ""} className="input">
              <option value="">—</option>
              {modeNames.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Bill / receipt #"><input name="reference" defaultValue={e?.reference ?? ""} className="input" /></Field>
        </div>
        <Field label="Note" className={compact ? "" : "sm:col-span-2"}><textarea name="note" rows={2} defaultValue={e?.note ?? ""} className="input" /></Field>
      </div>
      <div className="mt-4 flex justify-end">
        <SubmitButton>{e ? "Save changes" : "Add expense"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
