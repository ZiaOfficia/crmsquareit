import { notFound, redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { docNumber } from "@/lib/sales";
import { canSeeQuotation } from "@/lib/quotations";
import { PageHeader } from "@/components/ui";
import { QuotationForm } from "../../form";
import { updateQuotation } from "../../actions";

// The AI assistant runs as a server action of this page and can take a while.
export const maxDuration = 60;

export const metadata = { title: "Edit quotation" };

export default async function EditQuotation({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("quotations", "edit");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const q = await db.quotation.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!q) notFound();
  if (!canSeeQuotation(user, q)) redirect("/admin/forbidden");
  if (q.status === "ACCEPTED") redirect(`/admin/quotations/${id}`);
  return (
    <div className="max-w-6xl">
      <PageHeader title={`Edit ${docNumber(q.prefix, q.number)}`} back={{ href: `/admin/quotations/${id}`, label: docNumber(q.prefix, q.number) }} />
      <QuotationForm action={updateQuotation.bind(null, id)} quotation={q} submitLabel="Save quotation" />
    </div>
  );
}
