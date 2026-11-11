import { Check, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { STAGE_INFO, FOLLOW_UP_CHANNELS, type LeadStage } from "@/lib/lead-flow";
import { inputDate } from "@/lib/format";
import { logFollowUp, setLeadStage } from "@/app/admin/leads/actions";
import { btn } from "./ui";
import { ActionForm, SubmitButton } from "./client";

/** The four steps a lead walks through; step 4 branches into hot / cold / junk. */
const STEPS: { key: string; label: string; stages: LeadStage[] }[] = [
  { key: "NEW", label: "Lead", stages: ["NEW"] },
  { key: "QUOTED", label: "Quotation", stages: ["QUOTED"] },
  { key: "FOLLOW_UP", label: "Follow-up", stages: ["FOLLOW_UP"] },
  { key: "SORT", label: "Hot / Cold / Junk", stages: ["HOT", "COLD", "JUNK"] },
  { key: "CUSTOMER", label: "Customer", stages: ["CUSTOMER"] },
];

/** Horizontal progress bar for one lead's journey. */
export function LeadJourney({ stage }: { stage: LeadStage }) {
  const at = STEPS.findIndex((s) => s.stages.includes(stage));
  return (
    <ol className="flex items-center gap-1 overflow-x-auto p-4">
      {STEPS.map((s, i) => {
        const done = i < at || stage === "CUSTOMER";
        const current = i === at && stage !== "CUSTOMER";
        const label = s.key === "SORT" && current ? STAGE_INFO[stage].label : s.label;
        const color = s.key === "SORT" && i <= at ? STAGE_INFO[stage === "CUSTOMER" ? "HOT" : stage].color : undefined;
        return (
          <li key={s.key} className="flex shrink-0 items-center gap-1">
            <span
              className={clsx(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                done && "bg-green-50 text-brand-green",
                current && "text-white",
                !done && !current && "bg-slate-100 text-slate-400"
              )}
              style={current ? { backgroundColor: color ?? STAGE_INFO[stage].color } : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
              {label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Hot / Cold / Junk buttons (and "reopen" for an already-sorted lead). */
export function StageButtons({ id, stage, compact }: { id: number; stage: LeadStage; compact?: boolean }) {
  if (stage === "CUSTOMER") return null;
  const size = compact ? "px-2.5 py-1 text-xs" : undefined;
  const options: { stage: string; label: string; cls: string }[] = [
    { stage: "HOT", label: "🔥 Hot", cls: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" },
    { stage: "COLD", label: "❄ Cold", cls: "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100" },
    { stage: "JUNK", label: "Junk", cls: "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options
        .filter((o) => o.stage !== stage)
        .map((o) => (
          <form key={o.stage} action={setLeadStage}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="stage" value={o.stage} />
            <button className={clsx("inline-flex items-center rounded-lg border font-medium transition", compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm", o.cls)}>{o.label}</button>
          </form>
        ))}
      {(stage === "HOT" || stage === "COLD" || stage === "JUNK") && (
        <form action={setLeadStage}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="stage" value="OPEN" />
          <button className={btn("ghost", size)}>Reopen</button>
        </form>
      )}
    </div>
  );
}

/** Form to log a follow-up; picking an outcome sorts the lead. */
export function FollowUpForm({ leadId, nextFollowUp }: { leadId: number; nextFollowUp?: Date | null }) {
  const soon = new Date(Date.now() + 3 * 86_400_000);
  return (
    <ActionForm action={logFollowUp} resetOnSuccess savedText="Follow-up logged." className="space-y-3 p-4">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex flex-wrap gap-2">
        {Object.entries(FOLLOW_UP_CHANNELS).map(([k, label], i) => (
          <label key={k} className="cursor-pointer">
            <input type="radio" name="channel" value={k} defaultChecked={i === 0} className="peer sr-only" />
            <span className="inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary">
              {label}
            </span>
          </label>
        ))}
      </div>
      <textarea name="note" rows={2} className="input" placeholder="What did the client say about the quotation?" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="label">Outcome</span>
          <select name="outcome" className="input" defaultValue="">
            <option value="">Still deciding — keep following up</option>
            <option value="HOT">🔥 Hot — interested, likely to buy</option>
            <option value="COLD">❄ Cold — not now, nurture later</option>
            <option value="JUNK">Junk — not a real prospect</option>
          </select>
        </div>
        <div>
          <span className="label">Next follow-up</span>
          <input type="date" name="nextDate" className="input" defaultValue={inputDate(nextFollowUp && nextFollowUp > new Date() ? nextFollowUp : soon)} />
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton>Log follow-up</SubmitButton>
      </div>
    </ActionForm>
  );
}
