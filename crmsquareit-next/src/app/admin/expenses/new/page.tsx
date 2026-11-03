import { requirePerm } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ExpenseForm } from "../form";
import { saveExpense } from "../actions";

export const metadata = { title: "New expense" };
export default async function NewExpense() {
  await requirePerm("expenses", "create");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Record expense" back={{ href: "/admin/expenses", label: "Expenses" }} />
      <ExpenseForm action={saveExpense.bind(null, null)} />
    </div>
  );
}
