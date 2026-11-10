"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { calcTotals, docNumber } from "@/lib/sales";
import { fillTemplate } from "@/lib/quotation-content";
import { Prisma } from "@prisma/client";
import { canSeeQuotation, nextQuotationNumber, QUOTATION_STATUSES, type QuotationStatus } from "@/lib/quotations";
import { dateOrNull, intOrNull, num, reqStr, str, type ActionState } from "@/lib/forms";

type Row = { description: string; longDescription: string | null; qty: number; rate: number; unit: null; taxRate: number; tag: string | null; note: string | null };

/** Services posted by <ServicesEditor/> (hidden JSON field "services") → line item rows. */
function parseServices(f: FormData): Row[] {
  try {
    const raw = JSON.parse(String(f.get("services") || "[]"));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x) => x && String(x.title ?? "").trim())
      .map((x) => ({
        description: String(x.title).trim().slice(0, 200),
        longDescription: String(x.points ?? "").trim() || null,
        qty: 1,
        rate: Math.round((Number(x.fee) || 0) * 100) / 100,
        unit: null,
        taxRate: Math.max(0, Number(x.taxRate) || 0),
        tag: String(x.tag ?? "").trim().toUpperCase().slice(0, 8) || null,
        note: String(x.note ?? "").trim().slice(0, 120) || null,
      }));
  } catch {
    return [];
  }
}

/** JSON list field (scope sections / steps) with the given string keys. */
function parseList(f: FormData, name: string, keys: [string, string]) {
  try {
    const raw = JSON.parse(String(f.get(name) || "[]"));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((x) => ({ [keys[0]]: String(x?.[keys[0]] ?? "").trim(), [keys[1]]: String(x?.[keys[1]] ?? "").trim() }))
      .filter((x) => x[keys[0]] || x[keys[1]])
      .slice(0, 40);
  } catch {
    return [];
  }
}

const itemRows = (items: Row[]) => items.map((i, k) => ({ ...i, sortOrder: k }));

/** "lead:12" or "customer:4" from the recipient picker. */
function parseFor(v: string | null) {
  const [kind, raw] = (v ?? "").split(":");
  const id = Number(raw);
  return { leadId: kind === "lead" && id ? id : null, customerId: kind === "customer" && id ? id : null };
}

async function parse(f: FormData) {
  const items = parseServices(f);
  const discountPercent = Math.min(100, Math.max(0, num(f, "discountPercent")));
  const adjustment = num(f, "adjustment");
  const subject = reqStr(f, "subject");
  const clientName = reqStr(f, "clientName");
  let { leadId, customerId } = parseFor(str(f, "for"));
  if (!subject) return { error: "What is the quotation for? e.g. \"Website Development\"." } as const;
  if (!clientName) return { error: "Who is it for? Add the client's name." } as const;
  if (!items.length) return { error: "Add at least one service with a name." } as const;
  if (items.some((i) => i.rate <= 0)) return { error: "Each service needs a fee above 0." } as const;
  // Ignore links to records that no longer exist.
  if (leadId && !(await db.lead.count({ where: { id: leadId } }))) leadId = null;
  if (customerId && !(await db.customer.count({ where: { id: customerId } }))) customerId = null;
  const date = dateOrNull(f, "date") ?? new Date();
  const validUntil = dateOrNull(f, "validUntil");
  if (validUntil && validUntil < date) return { error: "\"Valid until\" is before the quotation date." } as const;
  return {
    items,
    data: {
      subject,
      leadId,
      customerId,
      clientName,
      clientCompany: str(f, "clientCompany"),
      clientEmail: str(f, "clientEmail"),
      clientPhone: str(f, "clientPhone"),
      clientAddress: str(f, "clientAddress"),
      date,
      validUntil,
      currency: reqStr(f, "currency") || "INR",
      discountPercent,
      adjustment,
      subtitle: str(f, "subtitle"),
      intro: (() => {
        const t = str(f, "intro");
        return t ? fillTemplate(t, subject, clientName) : null;
      })(),
      scopeIntro: str(f, "scopeIntro"),
      scope: parseList(f, "scope", ["title", "body"]) as Prisma.InputJsonValue,
      steps: parseList(f, "steps", ["title", "text"]) as Prisma.InputJsonValue,
      terms: str(f, "terms"),
      closing: str(f, "closing"),
      ...calcTotals(items, discountPercent, adjustment),
    },
  } as const;
}

/** Loads a quotation the user may work on, or sends them away. */
async function loadOwn(id: number, user: Awaited<ReturnType<typeof requirePerm>>) {
  const q = await db.quotation.findUnique({ where: { id } });
  if (!q || !canSeeQuotation(user, q)) redirect("/admin/quotations");
  return q;
}

export async function createQuotation(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("quotations", "create");
  const p = await parse(f);
  if ("error" in p) return { error: p.error };
  const s = await getSettings();
  const q = await db.quotation.create({
    data: { ...p.data, number: await nextQuotationNumber(), prefix: s.quotation_prefix || "QT-", createdById: user.id, items: { create: itemRows(p.items) } },
  });
  const no = docNumber(q.prefix, q.number);
  await logActivity("quotation", q.id, `created quotation ${no} for ${q.clientCompany || q.clientName}`, user.id);
  if (q.leadId) await logActivity("lead", q.leadId, `created quotation ${no}`, user.id);
  redirect(`/admin/quotations/${q.id}`);
}

export async function updateQuotation(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("quotations", "edit");
  const q = await loadOwn(id, user);
  if (q.status === "ACCEPTED") return { error: "This quotation was accepted, so it can't be changed. Duplicate it to make a new version." };
  const p = await parse(f);
  if ("error" in p) return { error: p.error };
  await db.$transaction([
    db.lineItem.deleteMany({ where: { quotationId: id } }),
    db.quotation.update({ where: { id }, data: { ...p.data, items: { create: itemRows(p.items) } } }),
  ]);
  await logActivity("quotation", id, `updated quotation ${docNumber(q.prefix, q.number)}`, user.id);
  redirect(`/admin/quotations/${id}`);
}

export async function setQuotationStatus(f: FormData) {
  const user = await requirePerm("quotations", "edit");
  const id = Number(f.get("id"));
  const status = String(f.get("status")) as QuotationStatus;
  if (!QUOTATION_STATUSES.includes(status)) redirect(`/admin/quotations/${id}`);
  const q = await loadOwn(id, user);
  await db.quotation.update({ where: { id }, data: { status } });
  const no = docNumber(q.prefix, q.number);
  const verb = { DRAFT: "moved back to draft", SENT: "marked as sent", ACCEPTED: "marked as accepted", DECLINED: "marked as declined" }[status];
  await logActivity("quotation", id, `${verb} quotation ${no}`, user.id);
  if (q.leadId) {
    await logActivity("lead", q.leadId, `${verb} quotation ${no}`, user.id);
    // Sending a quotation counts as contacting the lead.
    if (status === "SENT") await db.lead.update({ where: { id: q.leadId }, data: { lastContact: new Date() } });
  }
  revalidatePath(`/admin/quotations/${id}`);
}

/** Copies a quotation as a new draft (new number, today's date). */
export async function duplicateQuotation(f: FormData) {
  const user = await requirePerm("quotations", "create");
  const src = await loadOwn(Number(f.get("id")), user);
  const items = await db.lineItem.findMany({ where: { quotationId: src.id }, orderBy: { sortOrder: "asc" } });
  const s = await getSettings();
  const { id: _id, number: _n, createdAt: _c, updatedAt: _u, createdById: _b, status: _s, prefix: _p, scope, steps, ...rest } = src;
  const q = await db.quotation.create({
    data: {
      ...rest,
      scope: scope ?? Prisma.DbNull,
      steps: steps ?? Prisma.DbNull,
      number: await nextQuotationNumber(),
      prefix: s.quotation_prefix || "QT-",
      date: new Date(),
      validUntil: new Date(Date.now() + Number(s.quotation_valid_days || 0) * 86_400_000),
      createdById: user.id,
      items: { create: items.map(({ id: _a, invoiceId: _i, estimateId: _e, quotationId: _q, ...it }) => it) },
    },
  });
  await logActivity("quotation", q.id, `duplicated quotation ${docNumber(src.prefix, src.number)} as ${docNumber(q.prefix, q.number)}`, user.id);
  redirect(`/admin/quotations/${q.id}/edit`);
}

export async function deleteQuotation(f: FormData) {
  const user = await requirePerm("quotations", "delete");
  const q = await loadOwn(Number(f.get("id")), user);
  await db.quotation.delete({ where: { id: q.id } });
  await logActivity("quotation", q.id, `deleted quotation ${docNumber(q.prefix, q.number)}`, user.id);
  redirect("/admin/quotations");
}

/** For the recipient picker: details of a lead or customer to prefill the form. */
export async function recipientDetails(value: string) {
  await requirePerm("quotations");
  const { leadId, customerId } = parseFor(value);
  if (leadId) {
    const l = await db.lead.findUnique({ where: { id: leadId } });
    if (!l) return null;
    return { clientName: l.name, clientCompany: l.company ?? "", clientEmail: l.email ?? "", clientPhone: l.phone ?? "", clientAddress: [l.address, l.city, l.country].filter(Boolean).join(", ") };
  }
  if (customerId) {
    const c = await db.customer.findUnique({ where: { id: customerId }, include: { contacts: { where: { active: true }, orderBy: { isPrimary: "desc" }, take: 1 } } });
    if (!c) return null;
    const p = c.contacts[0];
    return {
      clientName: p ? `${p.firstName} ${p.lastName}`.trim() : c.company,
      clientCompany: c.company,
      clientEmail: p?.email ?? "",
      clientPhone: p?.phone ?? c.phone ?? "",
      clientAddress: [c.address, [c.city, c.state, c.zip].filter(Boolean).join(" "), c.country].filter(Boolean).join(", "),
    };
  }
  return null;
}
