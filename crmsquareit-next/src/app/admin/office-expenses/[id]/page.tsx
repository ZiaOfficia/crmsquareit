import { notFound, redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { isLocked, monthKey } from "@/lib/office-expenses";
import { Card, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { OfficeExpenseForm } from "../form";
import { deleteOfficeExpense, saveOfficeExpense } from "../actions";

export const metadata = { title: "Edit office expense" };

export default async function EditOfficeExpense({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("office_expenses", "edit");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const e = await db.officeExpense.findUnique({ where: { id }, include: { createdBy: { select: { firstName: true, lastName: true } } } });
  if (!e) notFound();
  const month = monthKey(e.date);
  const report = await db.officeExpenseReport.findUnique({ where: { month }, select: { status: true } });
  if (!user.isAdmin && isLocked(report?.status)) redirect(`/admin/office-expenses?month=${month}`);
  const back = { href: `/admin/office-expenses?month=${month}`, label: "Office expenses" };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={e.title}
        subtitle={`Recorded by ${e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}` : "—"} · ${fmtDateTime(e.createdAt)}`}
        back={back}
        actions={can(user, "office_expenses", "delete") && <ConfirmButton action={deleteOfficeExpense} hidden={{ id: e.id }} confirmLabel="Delete this expense?" />}
      />
      {isLocked(report?.status) && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This month has been submitted. You&apos;re editing it as Super Admin; HR will see the updated total.
        </div>
      )}
      <Card>
        <div className="p-5">
          <OfficeExpenseForm action={saveOfficeExpense.bind(null, e.id)} expense={e} />
        </div>
      </Card>
    </div>
  );
}
