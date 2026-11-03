import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SalesForm } from "@/components/sales-form";
import { createEstimate } from "../actions";

export const metadata = { title: "New estimate" };

export default async function NewEstimate({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  await requirePerm("estimates", "create");
  const sp = await searchParams;
  const s = await getSettings();
  const customer = sp.customerId ? await db.customer.findUnique({ where: { id: Number(sp.customerId) } }) : null;
  return (
    <div className="max-w-6xl">
      <PageHeader title="New estimate" back={{ href: "/admin/estimates", label: "Estimates" }} />
      <SalesForm
        kind="estimate"
        action={createEstimate}
        submitLabel="Create estimate"
        values={{ customerId: customer?.id, secondDate: new Date(Date.now() + Number(s.estimate_expiry_days || 0) * 86400000), currency: customer?.currency || s.currency }}
      />
    </div>
  );
}
