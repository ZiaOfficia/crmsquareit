import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { docNumber } from "@/lib/sales";
import { PageHeader } from "@/components/ui";
import { SalesForm } from "@/components/sales-form";
import { updateInvoice } from "../../actions";

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("invoices", "edit");
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id: Number(id) }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!inv) notFound();
  const num = docNumber(inv.prefix, inv.number);
  return (
    <div className="max-w-6xl">
      <PageHeader title={`Edit ${num}`} back={{ href: `/admin/invoices/${inv.id}`, label: num }} />
      <SalesForm
        kind="invoice"
        action={updateInvoice.bind(null, inv.id)}
        submitLabel="Save invoice"
        values={{ ...inv, number: num, secondDate: inv.dueDate }}
      />
    </div>
  );
}
