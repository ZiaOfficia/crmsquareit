import { Avatar, StatusBadge, btn } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/client";
import { LEAVE_STATUS, LEAVE_TYPES, dayKey, dbKey, fmtDay } from "@/lib/hr";
import { applyLeave, cancelLeave, reviewLeave } from "./actions";

export type LeaveRowData = {
  id: number;
  type: string;
  fromDate: Date;
  toDate: Date;
  halfDay: boolean;
  days: number;
  reason: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: Date;
  staff?: { firstName: string; lastName: string; designation: string | null };
  reviewedBy?: { firstName: string } | null;
};

export const leaveRange = (l: { fromDate: Date; toDate: Date; halfDay: boolean }) => {
  const a = dbKey(l.fromDate);
  const b = dbKey(l.toDate);
  return a === b ? `${fmtDay(a)}${l.halfDay ? " · half day" : ""}` : `${fmtDay(a, { day: "numeric", month: "short" })} – ${fmtDay(b)}`;
};

/** One leave request. HR gets approve / reject; the owner can cancel while it's pending. */
export function LeaveRow({ l, review, cancel }: { l: LeaveRowData; review?: boolean; cancel?: boolean }) {
  return (
    <li className="flex flex-col gap-3 px-5 py-3 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {l.staff && <Avatar name={`${l.staff.firstName} ${l.staff.lastName}`} size={32} />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">
            {l.staff && <>{l.staff.firstName} {l.staff.lastName} · </>}
            {LEAVE_TYPES[l.type]?.label ?? l.type} · {l.days} day{l.days === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-slate-500">
            {leaveRange(l)}
            {l.reason && <> · “{l.reason}”</>}
          </p>
          {l.status !== "PENDING" && (l.reviewedBy || l.reviewNote) && (
            <p className="text-xs text-slate-400">
              {l.reviewedBy && <>By {l.reviewedBy.firstName}</>}
              {l.reviewNote && <> · {l.reviewNote}</>}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <StatusBadge map={LEAVE_STATUS} value={l.status} />
        {review && l.status === "PENDING" && (
          <form action={reviewLeave} className="flex flex-wrap items-center gap-1.5">
            <input type="hidden" name="id" value={l.id} />
            <input name="note" placeholder="Note (optional)" className="input h-8 w-40 py-1 text-xs" />
            <button name="decision" value="APPROVE" className={btn("success", "px-2.5 py-1 text-xs")}>Approve</button>
            <button name="decision" value="REJECT" className={btn("secondary", "px-2.5 py-1 text-xs")}>Reject</button>
          </form>
        )}
        {cancel && (l.status === "PENDING" || (review && l.status === "APPROVED" && dbKey(l.toDate) >= dayKey())) && (
          <form action={cancelLeave}>
            <input type="hidden" name="id" value={l.id} />
            <button className={btn("ghost", "px-2.5 py-1 text-xs")}>Cancel</button>
          </form>
        )}
      </div>
    </li>
  );
}

/** Apply for leave. With `staff`, HR picks the person and it's approved straight away. */
export function LeaveForm({ staff, balances }: { staff?: { id: number; name: string }[]; balances?: Record<string, { left: number; pending: number }> }) {
  const today = dayKey();
  return (
    <ActionForm action={applyLeave} resetOnSuccess savedText={staff ? "Leave added and approved." : "Leave request sent to HR."} className="space-y-3 p-4">
      {staff && (
        <div>
          <span className="label">Employee</span>
          <select name="staffId" className="input" required defaultValue="">
            <option value="" disabled>Pick a person…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <span className="label">Leave type</span>
        <select name="type" className="input" defaultValue="CASUAL">
          {Object.entries(LEAVE_TYPES).map(([k, t]) => (
            <option key={k} value={k}>
              {t.label}
              {balances?.[k] && Number.isFinite(balances[k].left) ? ` · ${Math.max(0, balances[k].left - balances[k].pending)} left` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label">From</span>
          <input type="date" name="fromDate" className="input" required defaultValue={today} />
        </div>
        <div>
          <span className="label">To</span>
          <input type="date" name="toDate" className="input" defaultValue={today} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="halfDay" /> Half day (single date)
      </label>
      <textarea name="reason" rows={2} className="input" placeholder="Reason" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">Weekly offs and holidays aren't counted.</p>
        <SubmitButton>{staff ? "Add leave" : "Apply"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "green" | "red" | "amber" | "blue" }) {
  const color = tone === "green" ? "text-brand-green" : tone === "red" ? "text-brand-red" : tone === "amber" ? "text-amber-600" : tone === "blue" ? "text-primary" : "text-ink";
  return (
    <div className="card p-4">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1.5 truncate text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

