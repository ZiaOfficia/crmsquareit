import "server-only";
import { db } from "./db";

export const DEFAULT_SETTINGS = {
  company_name: "Squareit",
  company_tagline: "Say Digital, Way Digital",
  company_email: "",
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
