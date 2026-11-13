import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { TaxInvoiceForm } from "../../form";
import { taxInvoiceFormProps } from "../../load";
import { updateTaxInvoice } from "../../actions";

export const metadata = { title: "Edit tax invoice" };

export default async function EditTaxInvoice({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("invoices", "edit");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const inv = await db.taxInvoice.findUnique({ where: { id } });
  if (!inv) notFound();
  const props = await taxInvoiceFormProps(inv);
  return (
    <div className="max-w-6xl">
      <PageHeader title={`Edit ${inv.number}`} back={{ href: `/admin/tax-invoices/${id}`, label: inv.number }} />
      <TaxInvoiceForm action={updateTaxInvoice.bind(null, id)} submitLabel="Save changes" {...props} />
    </div>
  );
}
