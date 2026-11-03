import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { docNumber, isOverdue } from "@/lib/sales";
import { INVOICE_STATUS } from "@/lib/constants";
import { StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/client";
import { SalesDocument } from "@/components/sales-document";

export const metadata = { title: "Invoice", robots: { index: false } };

export default async function PublicInvoice({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const inv = await db.invoice.findUnique({ where: { hash }, include: { items: { orderBy: { sortOrder: "asc" } }, customer: { include: { contacts: true } }, payments: true } });
  if (!inv || inv.status === "DRAFT") notFound();
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <SalesDocument
        settings={settings}
        doc={{ ...inv, title: "Invoice", number: docNumber(inv.prefix, inv.number), secondLabel: "Due date", secondDate: inv.dueDate, statusBadge: <StatusBadge map={INVOICE_STATUS} value={isOverdue(inv) ? "OVERDUE" : inv.status} /> }}
      />
    </div>
  );
}
