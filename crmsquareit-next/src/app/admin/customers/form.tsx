import type { Customer } from "@prisma/client";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field } from "@/components/ui";
import { CURRENCIES } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";

export function CustomerForm({ action, customer }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; customer?: Customer }) {
  const c = customer;
  return (
    <ActionForm action={action} className="space-y-6">
      <Card title="Company details">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Company name *" className="sm:col-span-2">
            <input name="company" required defaultValue={c?.company} className="input" />
          </Field>
          <Field label="GST / VAT number">
            <input name="vat" defaultValue={c?.vat ?? ""} className="input" />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={c?.phone ?? ""} className="input" />
          </Field>
          <Field label="Website">
            <input name="website" defaultValue={c?.website ?? ""} className="input" placeholder="https://" />
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={c?.currency ?? ""} className="input">
              <option value="">System default</option>
              {CURRENCIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <textarea name="address" rows={2} defaultValue={c?.address ?? ""} className="input" />
          </Field>
          <Field label="City">
            <input name="city" defaultValue={c?.city ?? ""} className="input" />
          </Field>
          <Field label="State">
            <input name="state" defaultValue={c?.state ?? ""} className="input" />
          </Field>
          <Field label="ZIP / PIN">
            <input name="zip" defaultValue={c?.zip ?? ""} className="input" />
          </Field>
          <Field label="Country">
            <input name="country" defaultValue={c?.country ?? "India"} className="input" />
          </Field>
          <Field label="Internal notes" className="sm:col-span-2">
            <textarea name="notes" rows={3} defaultValue={c?.notes ?? ""} className="input" />
          </Field>
          {c && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="active" defaultChecked={c.active} /> Active customer
            </label>
          )}
        </div>
      </Card>
      {!c && (
        <Card title="Primary contact (optional)">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="First name">
              <input name="contact_first" className="input" />
            </Field>
            <Field label="Last name">
              <input name="contact_last" className="input" />
            </Field>
            <Field label="Email">
              <input name="contact_email" type="email" className="input" />
            </Field>
            <Field label="Phone">
              <input name="contact_phone" className="input" />
            </Field>
          </div>
        </Card>
      )}
      <div className="flex justify-end">
        <SubmitButton>{c ? "Save changes" : "Create customer"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
