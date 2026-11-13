import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { taxInvoicePdf } from "@/lib/tax-invoice-pdf";

export const runtime = "nodejs";

/** GET /admin/tax-invoices/:id/pdf — downloads the GST invoice (?inline=1 opens it in the browser). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePerm("invoices");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const inv = await db.taxInvoice.findUnique({ where: { id } });
  if (!inv) notFound();

  let pdf: Buffer;
  try {
    pdf = await taxInvoicePdf(inv, await getSettings());
  } catch (e) {
    console.error(`[tax invoice pdf] #${id} failed:`, e);
    return new Response(`Couldn't create the PDF for this invoice: ${e instanceof Error ? e.message : String(e)}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  // Same naming as the template: "Shield Defence Academy October 2026 Invoice.pdf".
  const month = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "long", year: "numeric" }).format(inv.issueDate);
  const file = `${inv.billName.replace(/[^\w\- ]+/g, "").trim().slice(0, 60)} ${month} Invoice.pdf`.trim();
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
