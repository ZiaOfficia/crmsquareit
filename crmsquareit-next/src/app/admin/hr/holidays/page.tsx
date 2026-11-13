import clsx from "clsx";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card, EmptyState } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/client";
import { dayKey, dbDate, dbKey, fmtDay } from "@/lib/hr";
import { deleteHoliday, saveHoliday } from "../actions";

export const metadata = { title: "Holidays" };

export default async function HolidaysPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await requirePerm("hr");
  const canEdit = can(user, "hr", "edit");
  const today = dayKey();
  const y = Number((await searchParams).year) || Number(today.slice(0, 4));
  const holidays = await db.holiday.findMany({ where: { date: { gte: dbDate(`${y}-01-01`), lte: dbDate(`${y}-12-31`) } }, orderBy: { date: "asc" } });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card
        className="lg:col-span-2"
        title={`Holidays · ${y}`}
        actions={
          <div className="flex gap-3 text-xs">
            <a href={`?year=${y - 1}`} className="link">{y - 1}</a>
            <a href={`?year=${y + 1}`} className="link">{y + 1}</a>
          </div>
        }
      >
        {holidays.length === 0 ? (
          <EmptyState title="No holidays added" text="Holidays aren't counted as working days for leave or payroll." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {holidays.map((h) => {
              const k = dbKey(h.date);
              return (
                <li key={h.id} className={clsx("flex items-center gap-4 px-5 py-3", k < today && "opacity-50")}>
                  <div className="w-14 shrink-0 rounded-lg bg-primary/10 py-1 text-center text-primary">
                    <p className="text-lg font-bold leading-tight">{Number(k.slice(8))}</p>
                    <p className="text-[10px] font-semibold uppercase">{fmtDay(k, { month: "short" })}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{h.name}</p>
                    <p className="text-xs text-slate-500">{fmtDay(k, { weekday: "long" })}</p>
                  </div>
                  {canEdit && <ConfirmButton action={deleteHoliday} hidden={{ id: h.id }} label="✕" confirmLabel="Delete?" variant="ghost" className="px-2 py-1 text-xs" />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {canEdit && (
        <Card title="Add a holiday">
          <ActionForm action={saveHoliday} resetOnSuccess savedText="Holiday saved." className="space-y-3 p-4">
            <div>
              <span className="label">Date</span>
              <input type="date" name="date" required className="input" />
            </div>
            <div>
              <span className="label">Name</span>
              <input name="name" required className="input" placeholder="e.g. Diwali" />
            </div>
            <div className="flex justify-end">
              <SubmitButton>Save</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
