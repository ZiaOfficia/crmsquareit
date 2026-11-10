"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { money } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { dateOrNull, num, str, reqStr, type ActionState } from "@/lib/forms";
import { isLocked, isOfficeCategory, monthKey, parseMonth } from "@/lib/office-expenses";

function refresh() {
  revalidatePath("/admin", "layout");
}

async function monthStatus(key: string) {
  return (await db.officeExpenseReport.findUnique({ where: { month: key }, select: { status: true } }))?.status ?? null;
}

const lockedError = (label: string) => `${label} has been submitted to the Super Admin, so it can't be changed. Ask them to send it back first.`;

export async function saveOfficeExpense(id: number | null, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("office_expenses", id ? "edit" : "create");
  const title = reqStr(f, "title");
  const category = str(f, "category");
  const amount = num(f, "amount");
  const date = dateOrNull(f, "date");
  if (!title) return { error: "What was it for? Add a short description." };
  if (title.length > 160) return { error: "Keep the description under 160 characters." };
  if (!isOfficeCategory(category)) return { error: "Choose a category." };
  if (!(amount > 0)) return { error: "Enter an amount greater than zero." };
  if (!date || Number.isNaN(date.getTime())) return { error: "Pick the date it was paid." };
  // <input type="date"> is parsed as UTC midnight; keep it on the chosen calendar day locally.
  const day = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
  if (day.getTime() > Date.now() + 86_400_000) return { error: "The date is in the future." };

  const existing = id ? await db.officeExpense.findUnique({ where: { id } }) : null;
  if (id && !existing) return { error: "That expense no longer exists." };
  if (!user.isAdmin) {
    for (const d of [day, existing?.date].filter(Boolean) as Date[]) {
      const m = parseMonth(monthKey(d));
      if (isLocked(await monthStatus(m.key))) return { error: lockedError(m.label) };
    }
  }

  const data = {
    title,
    category,
    amount: Math.round(amount * 100) / 100,
    date: day,
    paidTo: str(f, "paidTo"),
    paymentMode: str(f, "paymentMode"),
    reference: str(f, "reference"),
    note: str(f, "note"),
  };
  const { currency } = await getSettings();
  if (existing) {
    await db.officeExpense.update({ where: { id: existing.id }, data });
    await logActivity("office_expense", existing.id, `updated office expense "${title}" (${money(data.amount, currency)})`, user.id);
    refresh();
    redirect(`/admin/office-expenses?month=${monthKey(day)}`);
  }
  const e = await db.officeExpense.create({ data: { ...data, createdById: user.id } });
  await logActivity("office_expense", e.id, `recorded office expense "${title}" (${money(data.amount, currency)})`, user.id);
  refresh();
  return { ok: true };
}

export async function deleteOfficeExpense(f: FormData) {
  const user = await requirePerm("office_expenses", "delete");
  const id = Number(f.get("id"));
  const e = await db.officeExpense.findUnique({ where: { id } });
  if (!e) redirect("/admin/office-expenses");
  const key = monthKey(e.date);
  if (!user.isAdmin && isLocked(await monthStatus(key))) redirect(`/admin/office-expenses?month=${key}`);
  await db.officeExpense.delete({ where: { id } });
  await logActivity("office_expense", id, `deleted office expense "${e.title}"`, user.id);
  refresh();
  redirect(`/admin/office-expenses?month=${key}`);
}

/** HR sends the month to the Super Admin. Takes a snapshot of the total. */
export async function submitOfficeReport(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("office_expenses", "create");
  const m = parseMonth(str(f, "month"));
  if (m.start > new Date()) return { error: "You can't submit a month that hasn't started." };
  const status = await monthStatus(m.key);
  if (isLocked(status)) return { error: `${m.label} is already ${status === "APPROVED" ? "approved" : "submitted"}.` };
  const agg = await db.officeExpense.aggregate({ _sum: { amount: true }, _count: true, where: { date: { gte: m.start, lt: m.end } } });
  if (!agg._count) return { error: `There are no office expenses recorded for ${m.label}.` };
  const data = {
    status: "SUBMITTED",
    total: agg._sum.amount ?? 0,
    count: agg._count,
    note: str(f, "note"),
    submittedById: user.id,
    submittedAt: new Date(),
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
  };
  const r = await db.officeExpenseReport.upsert({ where: { month: m.key }, create: { month: m.key, ...data }, update: data });
  const { currency } = await getSettings();
  await logActivity("office_report", r.id, `${status === "RETURNED" ? "resubmitted" : "submitted"} office expenses for ${m.label} (${money(r.total, currency)})`, user.id);
  refresh();
  return { ok: true };
}

/** Super Admin approves the month or sends it back to HR with a note. */
export async function reviewOfficeReport(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const m = parseMonth(str(f, "month"));
  const decision = str(f, "decision");
  const reviewNote = str(f, "reviewNote");
  const r = await db.officeExpenseReport.findUnique({ where: { month: m.key } });
  if (!r || r.status === "RETURNED") return { error: `${m.label} hasn't been submitted.` };
  if (decision !== "APPROVED" && decision !== "RETURNED") return { error: "Choose approve or send back." };
  if (decision === "RETURNED" && !reviewNote) return { error: "Tell HR what needs fixing." };
  await db.officeExpenseReport.update({ where: { id: r.id }, data: { status: decision, reviewedById: user.id, reviewedAt: new Date(), reviewNote } });
  await logActivity("office_report", r.id, `${decision === "APPROVED" ? "approved" : "sent back"} office expenses for ${m.label}`, user.id);
  refresh();
  return { ok: true };
}
