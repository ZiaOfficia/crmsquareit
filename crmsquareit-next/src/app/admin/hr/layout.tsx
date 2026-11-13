import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { HrNav } from "./nav";

export const metadata = { title: "HR portal" };

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  await requirePerm("hr");
  const pending = await db.leaveRequest.count({ where: { status: "PENDING" } });
  return (
    <>
      <div className="no-print mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">HR portal</p>
        <h1 className="text-2xl font-bold text-ink">People, attendance &amp; payroll</h1>
      </div>
      <HrNav pending={pending} />
      {children}
    </>
  );
}
