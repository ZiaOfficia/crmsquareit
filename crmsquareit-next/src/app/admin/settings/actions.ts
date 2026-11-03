"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { DEFAULT_SETTINGS, saveSettings, type Settings } from "@/lib/settings";
import type { ActionState } from "@/lib/forms";

export async function updateSettings(_: ActionState, f: FormData): Promise<ActionState> {
  await requirePerm("settings", "edit");
  const values: Partial<Settings> = {};
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = f.get(k);
    if (typeof v === "string") values[k] = v.trim();
  }
  await saveSettings(values);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/* ---- Generic lookup tables ---- */
export type LookupTable = "tax" | "item" | "paymentMode" | "leadStatus" | "leadSource" | "expenseCategory" | "department";

const FIELDS: Record<LookupTable, Record<string, "string" | "number" | "bool">> = {
  tax: { name: "string", rate: "number" },
  item: { description: "string", longDescription: "string", rate: "number", unit: "string", taxRate: "number" },
  paymentMode: { name: "string", active: "bool" },
  leadStatus: { name: "string", color: "string", order: "number" },
  leadSource: { name: "string" },
  expenseCategory: { name: "string" },
  department: { name: "string", email: "string" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = (t: LookupTable) => (db as any)[t];

export async function saveLookup(table: LookupTable, _: ActionState, f: FormData): Promise<ActionState> {
  await requirePerm("settings", "edit");
  const fields = FIELDS[table];
  if (!fields) return { error: "Unknown table" };
  const data: Record<string, unknown> = {};
  for (const [k, type] of Object.entries(fields)) {
    const raw = f.get(k);
    if (type === "bool") data[k] = raw === "on";
    else if (type === "number") data[k] = Number(raw) || 0;
    else data[k] = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }
  const first = Object.keys(fields)[0];
  if (!data[first]) return { error: "Name is required." };
  const id = Number(f.get("id") || 0);
  if (id) await model(table).update({ where: { id }, data });
  else await model(table).create({ data });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function deleteLookup(f: FormData) {
  await requirePerm("settings", "edit");
  const table = String(f.get("table")) as LookupTable;
  if (!FIELDS[table]) return;
  try {
    await model(table).delete({ where: { id: Number(f.get("id")) } });
  } catch {
    // in use (foreign key) — ignore silently
  }
  revalidatePath("/admin/settings");
}
