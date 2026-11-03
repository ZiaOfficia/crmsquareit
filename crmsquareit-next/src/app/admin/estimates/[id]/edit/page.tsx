import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { docNumber } from "@/lib/sales";
import { PageHeader } from "@/components/ui";
import { SalesForm } from "@/components/sales-form";
import { updateEstimate } from "../../actions";

export default async function EditEstimate({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("estimates", "edit");
  const { id } = await params;
  const est = await db.estimate.findUnique({ where: { id: Number(id) }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!est) notFound();
  const num = docNumber(est.prefix, est.number);
  return (
    <div className="max-w-6xl">
      <PageHeader title={`Edit ${num}`} back={{ href: `/admin/estimates/${est.id}`, label: num }} />
      <SalesForm kind="estimate" action={updateEstimate.bind(null, est.id)} submitLabel="Save estimate" values={{ ...est, number: num, secondDate: est.expiryDate }} />
    </div>
  );
}
