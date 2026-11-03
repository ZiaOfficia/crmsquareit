import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SalesForm } from "@/components/sales-form";
import { createInvoice } from "../actions";

export const metadata = { title: "New invoice" };

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ customerId?: string; projectId?: string }> }) {
  await requirePerm("invoices", "create");
  const sp = await searchParams;
  const s = await getSettings();
  const customer = sp.customerId ? await db.customer.findUnique({ where: { id: Number(sp.customerId) } }) : null;
  const due = new Date(Date.now() + Number(s.invoice_due_days || 0) * 86400000);
  return (
    <div className="max-w-6xl">
      <PageHeader title="New invoice" back={{ href: "/admin/invoices", label: "Invoices" }} />
      <SalesForm
        kind="invoice"
        action={createInvoice}
        submitLabel="Create invoice"
        values={{ customerId: customer?.id, projectId: sp.projectId ? Number(sp.projectId) : null, secondDate: due, currency: customer?.currency || s.currency }}
      />
    </div>
  );
}
