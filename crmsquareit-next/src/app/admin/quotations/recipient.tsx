"use client";
import { useState, useTransition } from "react";
import { recipientDetails } from "./actions";
import { useQuotationFill } from "./editors";

type Client = { clientName: string; clientCompany: string; clientEmail: string; clientPhone: string; clientAddress: string };
type Option = { value: string; label: string };

/** "For" picker (lead or customer) that prefills the client fields. The fields stay editable. */
export function RecipientFields({ leads, customers, initialFor, initial }: { leads: Option[]; customers: Option[]; initialFor: string; initial: Client }) {
  const [forValue, setFor] = useState(initialFor);
  const [c, setC] = useState<Client>(initial);
  const [pending, start] = useTransition();
  // The AI assistant fills in details it found in the notes; it never overwrites what's there unless undoing.
  useQuotationFill((d) => {
    if (!d.client) return;
    const n = d.client;
    const pick = (k: keyof Client, v: string | undefined) => (d.clientOverwrite ? v ?? "" : c[k] || v || "");
    setC({
      clientName: pick("clientName", n.name),
      clientCompany: pick("clientCompany", n.company),
      clientEmail: pick("clientEmail", n.email),
      clientPhone: pick("clientPhone", n.phone),
      clientAddress: pick("clientAddress", n.address),
    });
  });
  const set = (k: keyof Client) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value });

  function pick(v: string) {
    setFor(v);
    if (!v) return;
    start(async () => {
      const d = await recipientDetails(v);
      if (d) setC(d);
    });
  }

  const field = (k: keyof Client, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input name={k} value={c[k]} onChange={set(k)} className="input" {...props} />
    </label>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="label">For (lead or customer)</span>
        <select name="for" value={forValue} onChange={(e) => pick(e.target.value)} className="input">
          <option value="">— Someone new (type the details below) —</option>
          {leads.length > 0 && (
            <optgroup label="Leads">
              {leads.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          )}
          {customers.length > 0 && (
            <optgroup label="Customers">
              {customers.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          )}
        </select>
        <span className="mt-1 block text-xs text-slate-400">{pending ? "Filling in their details…" : "Picking one fills in the details below. You can still edit them."}</span>
      </label>
      {field("clientName", "Contact name *", { required: true })}
      {field("clientCompany", "Company")}
      {field("clientEmail", "Email", { type: "email" })}
      {field("clientPhone", "Phone")}
      <label className="block sm:col-span-2">
        <span className="label">Address</span>
        <textarea name="clientAddress" rows={2} value={c.clientAddress} onChange={set("clientAddress")} className="input" />
      </label>
    </div>
  );
}
