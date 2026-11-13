import { requirePerm } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TaxInvoiceForm } from "../form";
import { taxInvoiceFormProps } from "../load";
import { createTaxInvoice } from "../actions";

export const metadata = { title: "New tax invoice" };

export default async function NewTaxInvoice({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  await requirePerm("invoices", "create");
  const sp = await searchParams;
  const props = await taxInvoiceFormProps(null, { customerId: sp.customerId ? Number(sp.customerId) : undefined });
  return (
    <div className="max-w-6xl">
      <PageHeader title="New tax invoice" subtitle="GST invoice printed in the Squareit template" back={{ href: "/admin/tax-invoices", label: "Tax invoices" }} />
      <TaxInvoiceForm action={createTaxInvoice} submitLabel="Create invoice" {...props} />
    </div>
  );
}
