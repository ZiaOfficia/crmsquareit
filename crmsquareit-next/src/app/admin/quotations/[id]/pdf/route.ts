import { notFound, redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { docNumber } from "@/lib/sales";
import { canSeeQuotation, quotationInclude } from "@/lib/quotations";
import { quotationPdf } from "@/lib/quotation-pdf";

export const runtime = "nodejs";

/** GET /admin/quotations/:id/pdf — downloads the quotation as a PDF (?inline=1 opens it in the browser). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("quotations");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const q = await db.quotation.findUnique({ where: { id }, include: quotationInclude });
  if (!q) notFound();
  if (!canSeeQuotation(user, q)) redirect("/admin/forbidden");

  const pdf = await quotationPdf(q, await getSettings());
  const who = (q.clientCompany || q.clientName).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40);
  const file = `${docNumber(q.prefix, q.number)}${who ? `-${who}` : ""}.pdf`;
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
