"use server";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { AiError } from "@/lib/ai";
import { draftQuotation } from "@/lib/quotation-ai";
import type { QuotationDraft } from "@/lib/quotation-content";

export type AiDraftResult = { draft: QuotationDraft; error?: undefined } | { error: string; draft?: undefined };

/** "draft": write the whole quotation from rough notes. "polish": rewrite what's in the form into the house format. */
export async function aiQuotationDraft(input: { mode: "draft" | "polish"; notes: string; current?: Partial<QuotationDraft> }): Promise<AiDraftResult> {
  await requirePerm("quotations");
  const notes = String(input.notes ?? "").slice(0, 15_000);
  if (input.mode === "draft" && notes.trim().length < 10) return { error: "Paste the client's requirements or your call notes first." };
  try {
    const catalog = await db.item.findMany({ orderBy: { description: "asc" }, take: 60, select: { description: true, rate: true } });
    const draft = await draftQuotation({
      mode: input.mode === "polish" ? "polish" : "draft",
      notes,
      current: input.current,
      catalog: catalog.filter((c) => c.rate > 0).map((c) => ({ name: c.description, rate: c.rate })),
    });
    if (!draft.subject && !draft.services.length && !draft.scope.length) return { error: "The AI couldn't find a quotation in those notes. Add what the client needs and the prices." };
    return { draft };
  } catch (e) {
    if (e instanceof AiError) return { error: e.message };
    console.error("[ai] quotation draft failed", e);
    return { error: "Something went wrong while drafting. Please try again." };
  }
}
