import "server-only";
import { db } from "./db";

export const DEFAULT_SETTINGS = {
  company_name: "Squareit",
  company_tagline: "Say Digital, Way Digital",
  company_email: "Info@squareit.in",
  company_phone: "",
  company_address: "",
  company_city: "",
  company_state: "",
  company_zip: "",
  company_country: "India",
  company_vat: "",
  currency: "INR",
  invoice_prefix: "INV-",
  invoice_due_days: "15",
  invoice_terms: "",
  invoice_client_note: "Thank you for your business.",
  estimate_prefix: "EST-",
  estimate_expiry_days: "15",
  estimate_terms: "",
  company_legal_name: "Squareit Solutions",
  company_website: "www.squareit.in",
  quotation_prefix: "QT-",
  quotation_valid_days: "15",
  /** {subject} and {client} are filled in when a quotation is made. */
  quotation_intro: "This quotation covers {subject} for {client}. The full scope of work, pricing and terms are detailed below.",
  /** One step per line: "Title | text". */
  quotation_steps:
    "Confirm Scope | Approve this quotation in writing to lock the deliverables and fee.\nOnboarding | Share content, branding assets and any access we need.\nGo Live | Work begins and is delivered within the agreed timeline.",
  /** One term per line: "Label: text". */
  quotation_terms: "Payment: 50% advance to start the work, balance on completion.\nDelivery Timeline: From confirmation of scope.\nTaxes: Prices are exclusive of GST unless stated.",
  quotation_closing: "Thank you for the opportunity. We look forward to partnering with you.",
  bank_details: "",
};
export type SettingKey = keyof typeof DEFAULT_SETTINGS;
export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const s = { ...DEFAULT_SETTINGS } as Settings;
  for (const r of rows) if (r.key in s) s[r.key as SettingKey] = r.value;
  return s;
}

export async function saveSettings(values: Partial<Settings>) {
  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value: value ?? "" }, update: { value: value ?? "" } })
    )
  );
}
