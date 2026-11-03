import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { docNumber } from "@/lib/sales";
import { ESTIMATE_STATUS } from "@/lib/constants";
import { StatusBadge, btn } from "@/components/ui";
import { PrintButton } from "@/components/client";
import { SalesDocument } from "@/components/sales-document";
import { respondEstimate } from "./actions";

export const metadata = { title: "Estimate", robots: { index: false } };

export default async function PublicEstimate({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const est = await db.estimate.findUnique({ where: { hash }, include: { items: { orderBy: { sortOrder: "asc" } }, customer: { include: { contacts: true } } } });
  if (!est || est.status === "DRAFT") notFound();
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
        {est.status === "SENT" && (
          <>
            <form action={respondEstimate}><input type="hidden" name="hash" value={hash} /><input type="hidden" name="decision" value="decline" /><button className={btn("secondary")}>Decline</button></form>
            <form action={respondEstimate}><input type="hidden" name="hash" value={hash} /><input type="hidden" name="decision" value="accept" /><button className={btn("success")}>Accept estimate</button></form>
          </>
        )}
        {est.status === "ACCEPTED" && <p className="text-sm font-medium text-brand-green">Thank you — this estimate has been accepted.</p>}
        <PrintButton />
      </div>
      <SalesDocument settings={settings} doc={{ ...est, title: "Estimate", number: docNumber(est.prefix, est.number), secondLabel: "Valid until", secondDate: est.expiryDate, statusBadge: <StatusBadge map={ESTIMATE_STATUS} value={est.status} /> }} />
    </div>
  );
}
