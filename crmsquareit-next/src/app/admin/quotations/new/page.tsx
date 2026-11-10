import { requirePerm } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { QuotationForm } from "../form";
import { createQuotation } from "../actions";

// The AI assistant runs as a server action of this page and can take a while.
export const maxDuration = 60;

export const metadata = { title: "New quotation" };

/** ?leadId= or ?customerId= prefills the client (used by the buttons on lead and customer pages). */
export default async function NewQuotation({ searchParams }: { searchParams: Promise<{ leadId?: string; customerId?: string }> }) {
  await requirePerm("quotations", "create");
  const sp = await searchParams;
  return (
    <div className="max-w-6xl">
      <PageHeader title="New quotation" back={{ href: "/admin/quotations", label: "Quotations" }} />
      <QuotationForm action={createQuotation} submitLabel="Create quotation" preset={{ leadId: Number(sp.leadId) || undefined, customerId: Number(sp.customerId) || undefined }} />
    </div>
  );
}
