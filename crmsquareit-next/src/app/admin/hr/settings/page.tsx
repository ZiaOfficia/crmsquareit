import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/client";
import { hrConfig } from "@/lib/hr-server";
import { saveHrSettings } from "../actions";

export const metadata = { title: "HR settings" };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function HrSettingsPage() {
  const user = await requirePerm("hr");
  const canEdit = can(user, "hr", "edit");
  const { settings: s, weeklyOff } = await hrConfig();

  return (
    <Card title="HR settings" className="max-w-2xl">
      <ActionForm action={saveHrSettings} savedText="Settings saved." className="space-y-6 p-5">
        <fieldset disabled={!canEdit} className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Paid leave per year</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["hr_leave_casual", "Casual leave", s.hr_leave_casual],
                ["hr_leave_sick", "Sick leave", s.hr_leave_sick],
                ["hr_leave_earned", "Earned leave", s.hr_leave_earned],
              ].map(([k, label, v]) => (
                <div key={k}>
                  <span className="label">{label}</span>
                  <input name={k} type="number" min="0" step="0.5" defaultValue={v} className="input" />
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Balances reset every calendar year. Unpaid leave has no limit and is deducted in payroll.</p>
          </div>
          <div>
            <span className="label">Office start time</span>
            <input name="hr_work_start" type="time" defaultValue={s.hr_work_start} className="input w-40" />
            <p className="mt-1 text-[11px] text-slate-500">Check-ins after this time show as late.</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Weekly off</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => (
                <label key={d} className="cursor-pointer">
                  <input type="checkbox" name="hr_weekly_off" value={i} defaultChecked={weeklyOff.has(i)} className="peer sr-only" />
                  <span className="inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary">{d}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Weekly offs and holidays aren&apos;t working days for leave and payroll.</p>
          </div>
        </fieldset>
        {canEdit && (
          <div className="flex justify-end">
            <SubmitButton>Save</SubmitButton>
          </div>
        )}
      </ActionForm>
    </Card>
  );
}
