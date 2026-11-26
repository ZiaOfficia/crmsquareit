import "server-only";
import fs from "fs";
import path from "path";
import { db } from "../db";
import type { CurrentUser } from "../auth";
import { MODULES } from "../permissions";
import { membershipLabel } from "../org";
import { getSettings } from "../settings";
import { dayKey, dbDate, LEAVE_TYPES, parseWeeklyOff } from "../hr";
import { hrConfig, leaveBalances } from "../hr-server";
import { OFFICE_EXPENSE_CATEGORIES } from "../office-expenses";
import { getTaskScope } from "../task-access";
import { indiaToday, indiaTomorrow, indiaYear } from "../india-time";
import { getNotes } from "./notes";

/* ── The CRM Assistant's knowledge (the "R" in RAG) ─────────────────────
   Three sources, all searched the same way:
   1. Guides: src/knowledge/*.md, one chunk per "## " section. Edit or add a
      file there and redeploy to teach the assistant something permanent.
   2. Live facts: read from the database (lead statuses, departments and TLs,
      HR rules, holidays…), refreshed every few minutes, so answers follow
      whatever is set up in the CRM right now.
   3. Notes: taught by Super Admin / HR on the "Teach the assistant" page.
   Nothing outside these sources is given to the model. */

export type Chunk = { id: string; source: "guide" | "live" | "note"; title: string; text: string };

const KNOWLEDGE_DIR = path.join(process.cwd(), "src", "knowledge");
let guideCache: Chunk[] | null = null;

/** Splits each guide into sections ("# Doc" + "## Section" + body). */
export function loadGuides(): Chunk[] {
  if (guideCache && process.env.NODE_ENV === "production") return guideCache;
  const chunks: Chunk[] = [];
  let files: string[] = [];
  try {
    files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md")).sort();
  } catch (e) {
    console.error("[assistant] knowledge folder missing", e);
  }
  for (const file of files) {
    const text = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf8").replace(/\r\n/g, "\n");
    const doc = /^# (.+)$/m.exec(text)?.[1]?.trim() ?? file;
    const parts = text.split(/^## /m).slice(1);
    parts.forEach((part, i) => {
      const [heading, ...body] = part.split("\n");
      chunks.push({ id: `${file}#${i}`, source: "guide", title: `${doc} › ${heading.trim()}`, text: body.join("\n").trim() });
    });
  }
  guideCache = chunks;
  return chunks;
}

/* ── Live facts from the database ─────────────────────────────────────── */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
let liveCache: { at: number; chunks: Chunk[] } | null = null;
const LIVE_TTL = 5 * 60_000;

async function liveFacts(): Promise<Chunk[]> {
  if (liveCache && Date.now() - liveCache.at < LIVE_TTL) return liveCache.chunks;
  const today = indiaToday();
  const [settings, statuses, sources, depts, holidays, roles, modes, cats, taxes, supportDepts] = await Promise.all([
    getSettings(),
    db.leadStatus.findMany({ orderBy: { order: "asc" }, select: { name: true } }),
    db.leadSource.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    db.orgDepartment.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        name: true,
        parent: { select: { name: true } },
        members: { where: { staff: { active: true } }, select: { teamRole: true, staff: { select: { firstName: true, lastName: true } } } },
      },
    }),
    db.holiday.findMany({ where: { date: { gte: today, lt: new Date(today.getTime() + 366 * 86_400_000) } }, orderBy: { date: "asc" }, select: { date: true, name: true } }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    db.paymentMode.findMany({ where: { active: true }, select: { name: true } }),
    db.expenseCategory.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    db.tax.findMany({ select: { name: true, rate: true } }),
    db.department.findMany({ select: { name: true } }),
  ]);
  const names = (rows: { name: string }[]) => rows.map((r) => r.name).join(", ") || "none set up yet";
  const weeklyOff = [...parseWeeklyOff(settings.hr_weekly_off)].map((d) => DAY_NAMES[d]).join(", ") || "none";
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", weekday: "long", timeZone: "UTC" });

  const chunks: Chunk[] = [
    {
      id: "live:company",
      source: "live",
      title: "Company details (live)",
      text: `Company: ${settings.company_name} (${settings.company_legal_name}), ${settings.company_tagline}. Email ${settings.company_email}${settings.company_phone ? `, phone ${settings.company_phone}` : ""}. Website ${settings.company_website}. Default currency ${settings.currency}.`,
    },
    {
      id: "live:leads",
      source: "live",
      title: "Lead statuses and sources currently set up (live)",
      text: `Lead statuses (kanban columns, in order): ${names(statuses)}.\nLead sources: ${names(sources)}.`,
    },
    {
      id: "live:departments",
      source: "live",
      title: "Departments, team leads (TL) and executives right now (live)",
      text:
        depts
          .map((d) => {
            const tl = d.members.filter((m) => m.teamRole === "TL").map((m) => `${m.staff.firstName} ${m.staff.lastName}`.trim());
            const ex = d.members.filter((m) => m.teamRole === "EXECUTIVE").length;
            return `- ${d.parent ? `${d.parent.name} › ` : ""}${d.name}: TL ${tl.join(", ") || "not assigned"}; ${ex} executive(s).`;
          })
          .join("\n") || "No departments set up yet.",
    },
    {
      id: "live:hr",
      source: "live",
      title: "HR rules right now: office timing, weekly off, leave allowance (live)",
      text: `Office start time: ${settings.hr_work_start} (check-ins after this are late). Weekly off: ${weeklyOff}. Paid leave per calendar year: casual ${settings.hr_leave_casual} days, sick ${settings.hr_leave_sick} days, earned ${settings.hr_leave_earned} days. Unpaid leave has no limit but is deducted in payroll.`,
    },
    {
      id: "live:holidays",
      source: "live",
      title: "Upcoming company holidays (live)",
      text: holidays.length ? holidays.map((h) => `- ${fmt(h.date)}: ${h.name}`).join("\n") : "No upcoming holidays have been added yet (HR adds them in HR portal → Holidays).",
    },
    {
      id: "live:lists",
      source: "live",
      title: "Roles, payment modes, categories, tax rates and support departments set up (live)",
      text: `Roles: ${names(roles)}.\nPayment modes: ${names(modes)}.\nExpense categories: ${names(cats)}.\nOffice expense categories: ${OFFICE_EXPENSE_CATEGORIES.map((c) => c.label).join(", ")}.\nTax rates: ${taxes.map((t) => `${t.name} ${t.rate}%`).join(", ") || "none"}.\nSupport departments: ${names(supportDepts)}.`,
    },
    {
      id: "live:numbering",
      source: "live",
      title: "Document numbering and defaults (live)",
      text: `Invoice prefix ${settings.invoice_prefix}, due in ${settings.invoice_due_days} days. Estimate prefix ${settings.estimate_prefix}, valid ${settings.estimate_expiry_days} days. Quotation prefix ${settings.quotation_prefix}, valid ${settings.quotation_valid_days} days. Tax invoice prefix ${settings.tinv_prefix}, due in ${settings.tinv_due_days} days; seller state ${settings.tinv_seller_state}.`,
    },
  ];
  liveCache = { at: Date.now(), chunks };
  return chunks;
}

export async function allChunks(): Promise<Chunk[]> {
  const [live, notes] = await Promise.all([liveFacts().catch((e) => (console.error("[assistant] live facts", e), [] as Chunk[])), getNotes()]);
  return [
    ...loadGuides(),
    ...live,
    ...notes.map((n) => ({ id: `note:${n.id}`, source: "note" as const, title: `${n.title} (note from management)`, text: n.content })),
  ];
}

/* ── Who is asking (always given to the model) ─────────────────────────── */

export async function userContext(user: CurrentUser): Promise<string> {
  const today = indiaToday();
  const tomorrow = indiaTomorrow();
  const scope = await getTaskScope(user);
  const access = MODULES.map((m) => {
    const acts = user.isAdmin ? ["view", "create", "edit", "delete"] : user.permissions[m.key] ?? [];
    return acts.length ? `${m.label} (${acts.join(", ")})` : null;
  }).filter(Boolean);

  const openMine = { assignees: { some: { id: user.id } }, status: { not: "COMPLETE" } };
  const [openTasks, overdue, dueSoon, followUps, att, myLeave, pendingApprovals] = await Promise.all([
    db.task.count({ where: openMine }),
    db.task.count({ where: { ...openMine, dueDate: { lt: today } } }),
    db.task.findMany({ where: { ...openMine, dueDate: { not: null } }, orderBy: { dueDate: "asc" }, take: 5, select: { name: true, dueDate: true, status: true } }),
    user.isBDE ? db.lead.count({ where: { assignedId: user.id, customerId: null, junk: false, lost: false, nextFollowUp: { lt: tomorrow } } }) : Promise.resolve(null),
    db.attendance.findUnique({ where: { staffId_date: { staffId: user.id, date: dbDate(dayKey()) } }, select: { status: true, checkIn: true, checkOut: true } }),
    db.leaveRequest.count({ where: { staffId: user.id, status: "PENDING" } }),
    user.isAdmin || user.isHR ? db.leaveRequest.count({ where: { status: "PENDING" } }) : Promise.resolve(null),
  ]);
  const cfg = await hrConfig();
  const bal = (await leaveBalances([user.id], indiaYear(), cfg.quota))[user.id];
  const balance = Object.entries(LEAVE_TYPES)
    .filter(([k]) => k !== "UNPAID")
    .map(([k, t]) => `${t.label} ${bal[k].left} left${bal[k].pending ? ` (${bal[k].pending} pending)` : ""}`)
    .join(", ");
  const d = (x: Date) => x.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

  const who = user.isAdmin
    ? "Super Admin (full access to everything)"
    : [user.isHR ? "HR" : null, user.isBDE ? "BDE" : null, user.memberships.map(membershipLabel).join("; ") || null, user.roleName ? `role "${user.roleName}"` : null].filter(Boolean).join(", ") || "staff member with no department";
  const sees = scope.kind === "all" ? "everyone's tasks" : scope.kind === "team" ? "their own tasks and their Executives' tasks (they are a TL)" : "only their own tasks (they are an Executive)";

  return [
    `Name: ${user.firstName} ${user.lastName}`.trim(),
    `Position: ${who}`,
    `Today (India time): ${today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`,
    `Sidebar sections they can use: ${access.join("; ") || "only Dashboard, Announcements and My HR"}. Dashboard, Announcements and My HR are open to everyone.`,
    `Tasks they can see: ${sees}.`,
    `Their open tasks: ${openTasks} (${overdue} overdue).${dueSoon.length ? ` Next due: ${dueSoon.map((t) => `"${t.name}" due ${d(t.dueDate!)}`).join(", ")}.` : ""}`,
    followUps !== null ? `Lead follow-ups due today or overdue: ${followUps}.` : null,
    `Attendance today: ${att ? `${att.status}${att.checkIn ? ", checked in" : ""}${att.checkOut ? ", checked out" : ""}` : "not checked in yet"}.`,
    `Leave balance this year: ${balance}. Their pending leave requests: ${myLeave}.`,
    pendingApprovals !== null ? `Leave requests waiting for approval (company-wide): ${pendingApprovals}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ── Search: BM25 over the chunks ──────────────────────────────────────── */

const STOP = new Set(
  "a an the is are was were be to of in on for and or with at by from it this that i me my we you your how what where when why which who can do does did should will would please kya hai hain ka ki ke ko me mein se aur ya karna karu karoon kar raha rahi tha thi ho hota hoti batao bataiye bata kaise kese kaisa main mujhe mera meri hum ham".split(
    " "
  )
);

/** Everyday and Hinglish words → the words the guides use. */
const SYNONYMS: Record<string, string[]> = {
  chutti: ["leave", "holiday"], chhutti: ["leave", "holiday"], chuti: ["leave", "holiday"], off: ["leave", "holiday", "weekly"], vacation: ["leave"], absent: ["absent", "attendance", "leave"],
  salary: ["payroll", "payslip", "salary"], tankhwah: ["payroll", "salary"], pay: ["payroll", "payslip", "payment"], payslip: ["payroll", "payslip"],
  hazri: ["attendance", "check"], haziri: ["attendance", "check"], attendance: ["attendance", "check"], checkin: ["check", "attendance"], punch: ["check", "attendance"], late: ["late", "start", "time"], wfh: ["work", "home", "wfh"],
  banaye: ["create", "add", "new"], banana: ["create", "add", "new"], banao: ["create", "add", "new"], banau: ["create", "add", "new"], make: ["create", "add", "new"], add: ["add", "create", "new"], create: ["create", "add", "new"], new: ["new", "add", "create"],
  schedule: ["schedule", "due", "date", "task", "start"], assign: ["assign", "assignee", "task"], kaam: ["task", "work"], work: ["task", "work"], deadline: ["due", "deadline", "date"],
  hatana: ["delete", "remove"], hataye: ["delete", "remove"], remove: ["delete", "remove"], delete: ["delete", "remove"], edit: ["edit", "change"], change: ["edit", "change"], badle: ["edit", "change"], badlu: ["edit", "change"],
  client: ["customer", "client"], grahak: ["customer"], customer: ["customer", "client"],
  quote: ["quotation"], proposal: ["quotation"], quotation: ["quotation"], bill: ["invoice", "bill"], invoice: ["invoice"], gst: ["gst", "tax", "invoice"],
  prospect: ["lead"], enquiry: ["lead"], inquiry: ["lead"], lead: ["lead"], followup: ["follow", "followup"], follow: ["follow"], convert: ["convert", "customer"],
  password: ["password", "login", "reset"], login: ["login", "password"], forgot: ["forgot", "password", "reset"], access: ["access", "permission", "role"], permission: ["permission", "access", "role"], forbidden: ["forbidden", "access"],
  todo: ["todo", "to-do", "list"], announcement: ["announcement"], notice: ["announcement"], ticket: ["ticket", "support"], complaint: ["ticket", "support"], expense: ["expense"], kharcha: ["expense"],
  see: ["see", "access", "menu", "forbidden"], dikh: ["see", "access", "menu"], dikhta: ["see", "access", "menu"], dikhai: ["see", "access", "menu"], missing: ["missing", "access", "menu", "forbidden"], show: ["show", "see", "access"], error: ["error", "problem", "troubleshooting"], problem: ["problem", "troubleshooting"], nahi: ["can't", "problem"], galti: ["error", "problem"], today: ["today", "due", "overdue", "follow"], aaj: ["today", "due", "overdue"],
  tl: ["tl", "team", "lead"], manager: ["tl", "team", "lead"], boss: ["tl", "super", "admin"], hr: ["hr"], admin: ["admin", "super"],
};

const stem = (w: string) => (w.length > 4 ? w.replace(/(ings|ing|ies|es|ed|s)$/, "") : w);
const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/to-do/g, "todo")
    .replace(/follow[\s-]?ups?/g, "followup follow")
    .split(/[^a-z0-9ऀ-ॿ]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
const tokens = (t: string) => words(t).map(stem);
const queryTokens = (q: string) => {
  const out: string[] = [];
  for (const w of words(q)) out.push(stem(w), ...(SYNONYMS[w] ?? SYNONYMS[stem(w)] ?? []).map(stem));
  return out;
};

type Indexed = { chunk: Chunk; tf: Map<string, number>; len: number };

export function search(query: string, chunks: Chunk[], k = 6): Chunk[] {
  // Titles count three times: a heading like "Apply for leave" is the best signal.
  const docs: Indexed[] = chunks.map((chunk) => {
    const toks = [...tokens(chunk.title), ...tokens(chunk.title), ...tokens(chunk.title), ...tokens(chunk.text)];
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { chunk, tf, len: toks.length };
  });
  const avg = docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const q = queryTokens(query);
  const K1 = 1.2;
  const B = 0.75;
  const scored = docs.map((d) => {
    let score = 0;
    for (const t of new Set(q)) {
      const f = d.tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (docs.length - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      const weight = q.filter((x) => x === t).length; // repeated query words count more
      score += weight * idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / avg)));
    }
    // Notes from management are the freshest word: a small nudge up.
    if (d.chunk.source === "note" && score > 0) score *= 1.25;
    return { chunk: d.chunk, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.chunk);
}
