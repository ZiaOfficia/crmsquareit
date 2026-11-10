import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, CheckCircle2, Lock, Send, Undo2 } from "lucide-react";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, money } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { isLocked, monthKey, officeCategoryLabel, parseMonth, REPORT_STATUS, shiftMonth } from "@/lib/office-expenses";
import { Badge, Card, EmptyState, PageHeader, StatusBadge, btn } from "@/components/ui";
import { ActionForm, PrintButton, SubmitButton } from "@/components/client";
import { OfficeExpenseForm } from "./form";
import { reviewOfficeReport, saveOfficeExpense, submitOfficeReport } from "./actions";

export const metadata = { title: "Office expenses" };

const name = (s: { firstName: string; lastName: string } | null | undefined) => (s ? `${s.firstName} ${s.lastName}`.trim() : "—");

export default async function OfficeExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requirePerm("office_expenses");
  const m = parseMonth((await searchParams).month);
  const prev = parseMonth(shiftMonth(m.key, -1));
  const thisMonth = monthKey(new Date());
  const isFuture = m.key > thisMonth;
  const { currency } = await getSettings();

  const [rows, prevSum, report, history] = await Promise.all([
    db.officeExpense.findMany({
      where: { date: { gte: m.start, lt: m.end } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    }),
    db.officeExpense.aggregate({ _sum: { amount: true }, where: { date: { gte: prev.start, lt: prev.end } } }),
    db.officeExpenseReport.findUnique({ where: { month: m.key }, include: { submittedBy: { select: { firstName: true, lastName: true } }, reviewedBy: { select: { firstName: true, lastName: true } } } }),
    db.officeExpenseReport.findMany({ orderBy: { month: "desc" }, take: 12 }),
  ]);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const prevTotal = prevSum._sum.amount ?? 0;
  const change = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const byCat = Object.entries(
    rows.reduce<Record<string, { total: number; count: number }>>((acc, r) => {
      (acc[r.category] ??= { total: 0, count: 0 }).total += r.amount;
      acc[r.category].count++;
      return acc;
    }, {})
  ).sort((a, b) => b[1].total - a[1].total);

  const status = report?.status ?? "OPEN";
  const locked = isLocked(status);
  const canChange = user.isAdmin || !locked;
  const canAdd = can(user, "office_expenses", "create") && canChange && !isFuture;
  const changedSinceSubmit = !!report && locked && (Math.abs(report.total - total) > 0.005 || report.count !== rows.length);

  return (
    <>
      <PageHeader
        title="Office expenses"
        subtitle="Day-to-day running costs of the office. At month end, HR submits the month to the Super Admin."
        actions={
          <div className="no-print flex items-center gap-2">
            <PrintButton />
          </div>
        }
      />

      {/* Month switcher */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <Link href={`/admin/office-expenses?month=${prev.key}`} className="no-print rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-36 px-2 text-center text-sm font-semibold text-slate-800">{m.label}</span>
          <Link href={`/admin/office-expenses?month=${shiftMonth(m.key, 1)}`} className={clsx("no-print rounded-lg p-2 text-slate-500 hover:bg-slate-100", m.key >= thisMonth && "pointer-events-none opacity-30")} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {m.key !== thisMonth && (
            <Link href="/admin/office-expenses" className="no-print text-xs font-medium text-slate-500 hover:text-primary">
              Back to this month
            </Link>
          )}
          <StatusBadge map={REPORT_STATUS} value={status} />
        </div>
      </div>

      <StatusBanner report={report} label={m.label} isAdmin={user.isAdmin} changed={changedSinceSubmit} currency={currency} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`Total · ${m.label}`} value={money(total, currency)} sub={`${rows.length} ${rows.length === 1 ? "entry" : "entries"}`} />
        <Kpi
          label="vs last month"
          value={change === null ? "—" : `${change > 0 ? "+" : ""}${change}%`}
          sub={`${prev.label}: ${money(prevTotal, currency)}`}
          tone={change === null ? undefined : change > 0 ? "red" : "green"}
        />
        <Kpi label="Biggest category" value={byCat[0] ? officeCategoryLabel(byCat[0][0]) : "—"} sub={byCat[0] ? money(byCat[0][1].total, currency) : "Nothing yet"} />
        <Kpi label="Daily average" value={money(total / daysCounted(m.start, m.end), currency)} sub={m.key === thisMonth ? "so far this month" : "for the month"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="By category">
            {byCat.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">No expenses in {m.label}.</p>
            ) : (
              <ul className="space-y-3 p-5">
                {byCat.map(([cat, v]) => {
                  const pct = total ? (v.total / total) * 100 : 0;
                  return (
                    <li key={cat}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-700">
                          {officeCategoryLabel(cat)} <span className="font-normal text-slate-400">· {v.count}</span>
                        </span>
                        <span className="tabular-nums text-slate-800">
                          {money(v.total, currency)} <span className="ml-1 text-xs text-slate-400">{Math.round(pct)}%</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 1.5)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={`Entries · ${m.label}`} actions={locked && !user.isAdmin && <span className="flex items-center gap-1 text-xs text-slate-500"><Lock className="h-3 w-3" /> Locked</span>}>
            {rows.length === 0 ? (
              <EmptyState title="No office expenses" text={isFuture ? "This month hasn't started yet." : canAdd ? "Add the first one with the form." : undefined} />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/70">
                    <tr>
                      <th className="th">Date</th>
                      <th className="th">Description</th>
                      <th className="th">Category</th>
                      <th className="th">Paid by</th>
                      <th className="th text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="td whitespace-nowrap text-slate-500">{fmtDate(r.date)}</td>
                        <td className="td">
                          {canChange && can(user, "office_expenses", "edit") ? (
                            <Link href={`/admin/office-expenses/${r.id}`} className="font-medium text-slate-800 hover:text-primary">{r.title}</Link>
                          ) : (
                            <span className="font-medium text-slate-800">{r.title}</span>
                          )}
                          <span className="block text-xs text-slate-400">
                            {[r.paidTo, r.reference && `#${r.reference}`, `by ${name(r.createdBy)}`].filter(Boolean).join(" · ")}
                          </span>
                          {r.note && <span className="block text-xs text-slate-500">{r.note}</span>}
                        </td>
                        <td className="td"><Badge>{officeCategoryLabel(r.category)}</Badge></td>
                        <td className="td text-slate-500">{r.paymentMode ?? "—"}</td>
                        <td className="td text-right font-semibold tabular-nums">{money(r.amount, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/70">
                      <td className="td font-semibold" colSpan={4}>Total</td>
                      <td className="td text-right font-bold tabular-nums">{money(total, currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="no-print space-y-6">
          {canAdd && (
            <Card title="Add office expense">
              <div className="p-5">
                <OfficeExpenseForm action={saveOfficeExpense.bind(null, null)} compact defaultDate={m.key === thisMonth ? new Date() : new Date(m.end.getTime() - 43_200_000)} />
              </div>
            </Card>
          )}

          <ReportCard m={m} report={report} status={status} total={total} count={rows.length} isFuture={isFuture} canSubmit={!user.isAdmin && can(user, "office_expenses", "create")} isAdmin={user.isAdmin} currency={currency} />

          <Card title="Monthly reports">
            {history.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">No months submitted yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link href={`/admin/office-expenses?month=${h.month}`} className={clsx("flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-slate-50", h.month === m.key && "bg-slate-50")}>
                      <span className="font-medium text-slate-700">{parseMonth(h.month).label}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-slate-600">{money(h.total, currency)}</span>
                        <StatusBadge map={REPORT_STATUS} value={h.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/** Days elapsed in the month (whole month if it's over). */
function daysCounted(start: Date, end: Date) {
  const now = new Date();
  const until = now < end ? now : end;
  return Math.max(1, Math.ceil((until.getTime() - start.getTime()) / 86_400_000));
}

type Report = {
  status: string;
  total: number;
  count: number;
  note: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  submittedBy: { firstName: string; lastName: string } | null;
  reviewedBy: { firstName: string; lastName: string } | null;
} | null;

function StatusBanner({ report, label, isAdmin, changed, currency }: { report: Report; label: string; isAdmin: boolean; changed: boolean; currency: string }) {
  if (!report) return null;
  const tone =
    report.status === "APPROVED" ? "border-green-200 bg-green-50 text-green-900" : report.status === "RETURNED" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={clsx("mb-5 rounded-xl border px-4 py-3 text-sm", tone)}>
      {report.status === "SUBMITTED" && (
        <p>
          <strong>{name(report.submittedBy)}</strong> submitted {label} ({money(report.total, currency)}, {report.count} entries) on {fmtDateTime(report.submittedAt)}.{" "}
          {isAdmin ? "Review it on the right." : "Waiting for the Super Admin to review it. The month is locked until then."}
        </p>
      )}
      {report.status === "APPROVED" && (
        <p className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" /> Approved by <strong>{name(report.reviewedBy)}</strong> on {fmtDateTime(report.reviewedAt)}.
        </p>
      )}
      {report.status === "RETURNED" && (
        <p>
          <strong>Sent back</strong> by {name(report.reviewedBy)} on {fmtDateTime(report.reviewedAt)}. Fix the entries and submit again.
        </p>
      )}
      {report.note && report.status !== "RETURNED" && <p className="mt-1 whitespace-pre-line text-xs opacity-80">HR note: {report.note}</p>}
      {report.reviewNote && <p className="mt-1 whitespace-pre-line text-xs opacity-80">Super Admin: {report.reviewNote}</p>}
      {changed && <p className="mt-1 text-xs font-semibold">Entries were changed by a Super Admin after it was submitted; the totals below are current.</p>}
    </div>
  );
}

function ReportCard({ m, report, status, total, count, isFuture, canSubmit, isAdmin, currency }: { m: ReturnType<typeof parseMonth>; report: Report; status: string; total: number; count: number; isFuture: boolean; canSubmit: boolean; isAdmin: boolean; currency: string }) {
  if (isFuture) return null;
  const locked = isLocked(status);

  if (isAdmin) {
    if (status !== "SUBMITTED" && status !== "APPROVED")
      return (
        <Card title="Month-end report">
          <p className="px-5 py-5 text-sm text-slate-500">{status === "RETURNED" ? "Sent back to HR. It will appear here again when they resubmit." : `HR hasn't submitted ${m.label} yet.`}</p>
        </Card>
      );
    return (
      <Card title={status === "SUBMITTED" ? "Review this month" : "Month-end report"}>
        <ActionForm action={reviewOfficeReport} className="space-y-3 p-5">
          <input type="hidden" name="month" value={m.key} />
          <p className="text-sm text-slate-600">
            Submitted total <strong className="text-slate-800">{money(report!.total, currency)}</strong> across {report!.count} entries.
          </p>
          <textarea name="reviewNote" rows={2} placeholder={status === "SUBMITTED" ? "Comment (required to send back)" : "Why are you sending it back?"} className="input" />
          <div className="flex flex-wrap justify-end gap-2">
            <button name="decision" value="RETURNED" className={btn("secondary")}>
              <Undo2 className="h-4 w-4" /> Send back
            </button>
            {status === "SUBMITTED" && (
              <button name="decision" value="APPROVED" className={btn("success")}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
            )}
          </div>
        </ActionForm>
      </Card>
    );
  }

  if (!canSubmit) return null;
  return (
    <Card title="Month-end report">
      {locked ? (
        <p className="px-5 py-5 text-sm text-slate-500">
          {status === "APPROVED" ? `${m.label} is approved and closed.` : `${m.label} is with the Super Admin for review.`}
        </p>
      ) : (
        <ActionForm action={submitOfficeReport} savedText="Submitted to the Super Admin." className="space-y-3 p-5">
          <input type="hidden" name="month" value={m.key} />
          <p className="text-sm text-slate-600">
            Send <strong className="text-slate-800">{money(total, currency)}</strong> ({count} {count === 1 ? "entry" : "entries"}) for {m.label} to the Super Admin. The month locks once submitted.
          </p>
          <textarea name="note" rows={2} placeholder="Note for the Super Admin (optional)" defaultValue={report?.status === "RETURNED" ? report.note ?? "" : ""} className="input" />
          <div className="flex justify-end">
            <SubmitButton>
              <Send className="h-4 w-4" /> {status === "RETURNED" ? "Resubmit" : "Submit to Super Admin"}
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </Card>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "red" | "green" }) {
  return (
    <div className="card p-4">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={clsx("mt-1.5 truncate text-xl font-bold", tone === "red" ? "text-brand-red" : tone === "green" ? "text-brand-green" : "text-ink")}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
