import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { ExpenseForm } from "../form";
import { deleteExpense, saveExpense } from "../actions";

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("expenses", "edit");
  const { id } = await params;
  const e = await db.expense.findUnique({ where: { id: Number(id) } });
  if (!e) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={e.name} back={{ href: "/admin/expenses", label: "Expenses" }} actions={can(user, "expenses", "delete") && <ConfirmButton action={deleteExpense} hidden={{ id: e.id }} />} />
      <ExpenseForm action={saveExpense.bind(null, e.id)} expense={e} />
    </div>
  );
}
