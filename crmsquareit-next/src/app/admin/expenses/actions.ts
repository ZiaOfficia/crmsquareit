"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { str, reqStr, num, intOrNull, dateOrNull, bool, type ActionState } from "@/lib/forms";

function data(f: FormData) {
  return {
    name: reqStr(f, "name"),
    categoryId: intOrNull(f, "categoryId") ?? 0,
    amount: num(f, "amount"),
    taxRate: num(f, "taxRate"),
    date: dateOrNull(f, "date") ?? new Date(),
    customerId: intOrNull(f, "customerId"),
    projectId: intOrNull(f, "projectId"),
    paymentMode: str(f, "paymentMode"),
    reference: str(f, "reference"),
    note: str(f, "note"),
    billable: bool(f, "billable"),
  };
}

export async function saveExpense(id: number | null, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("expenses", id ? "edit" : "create");
  const d = data(f);
  if (!d.name || !d.categoryId || d.amount <= 0) return { error: "Name, category and a positive amount are required." };
  const e = id ? await db.expense.update({ where: { id }, data: d }) : await db.expense.create({ data: d });
  await logActivity("expense", e.id, `${id ? "updated" : "recorded"} expense ${e.name}`, user.id);
  redirect("/admin/expenses");
}

export async function deleteExpense(f: FormData) {
  await requirePerm("expenses", "delete");
  await db.expense.delete({ where: { id: Number(f.get("id")) } });
  redirect("/admin/expenses");
}
