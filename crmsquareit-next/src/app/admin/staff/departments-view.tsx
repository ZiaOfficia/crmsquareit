import Link from "next/link";
import { db } from "@/lib/db";
import { TEAM_ROLES } from "@/lib/org";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/client";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui";
import { addDepartmentMember, removeDepartmentMember } from "./actions";

const memberInclude = { members: { include: { staff: true }, orderBy: { createdAt: "asc" as const } } };

type Viewer = { id: number; isAdmin: boolean };

/** Rendered by /admin/staff?view=departments. The page checks Super Admin / HR before rendering this.
 *  HR can't place or remove Super Admins or themselves (the actions enforce this too). */
export async function DepartmentsView({ viewer }: { viewer: Viewer }) {
  const [tree, staff] = await Promise.all([
    db.orgDepartment.findMany({
      where: { parentId: null, active: true },
      orderBy: { sortOrder: "asc" },
      include: { ...memberInclude, children: { where: { active: true }, orderBy: { sortOrder: "asc" }, include: memberInclude } },
    }),
    db.staff.findMany({ where: { active: true }, orderBy: { firstName: "asc" }, include: { _count: { select: { orgMemberships: true } } } }),
  ]);
  const unassigned = staff.filter((s) => !s.isAdmin && s._count.orgMemberships === 0);
  const staffOptions = staff
    .filter((s) => viewer.isAdmin || (!s.isAdmin && s.id !== viewer.id))
    .map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim() }));
  const locked = new Set(viewer.isAdmin ? [] : [viewer.id, ...staff.filter((s) => s.isAdmin).map((s) => s.id)]);

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Organisation structure. Super Admins have full access everywhere and aren't limited by departments. HR can place people too."
        back={{ href: "/admin/staff", label: "Staff" }}
      />

      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Putting someone in HR gives them HR access</strong>: staff, departments, announcements, tasks, expenses, office expenses and invoices.
        For every other department, being in it doesn&apos;t change what someone can do yet; module access still comes from their{" "}
        {viewer.isAdmin ? <Link href="/admin/staff/roles" className="underline">role</Link> : "role"}.
      </div>

      {unassigned.length > 0 && (
        <p className="mb-5 text-sm text-slate-600">
          <span className="font-medium">{unassigned.length} active staff not in a department:</span>{" "}
          {unassigned.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link href={`/admin/staff/${s.id}`} className="link">{s.firstName} {s.lastName}</Link>
            </span>
          ))}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {tree.map((d) =>
          d.children.length ? (
            <Card key={d.id} title={d.name} actions={<Badge tone="blue">{d.children.length} sub-departments</Badge>} className="xl:col-span-2">
              <p className="border-b border-slate-100 px-5 py-2.5 text-xs text-slate-500">
                People are placed in a sub-department. Whether {d.name} has its own shared manager above them is still to be decided.
              </p>
              <div className="grid divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                {d.children.map((c) => (
                  <Unit key={c.id} id={c.id} name={c.name} members={c.members} staff={staffOptions} locked={locked} sub />
                ))}
              </div>
            </Card>
          ) : (
            <Card key={d.id} title={d.name} actions={<Badge>{d.members.length} {d.members.length === 1 ? "member" : "members"}</Badge>}>
              <Unit id={d.id} name={d.name} members={d.members} staff={staffOptions} locked={locked} />
            </Card>
          )
        )}
      </div>
    </>
  );
}

type MemberRow = { id: number; teamRole: string; staff: { id: number; firstName: string; lastName: string; active: boolean } };

function Unit({ id, name, members, staff, locked, sub }: { id: number; name: string; members: MemberRow[]; staff: { id: number; name: string }[]; locked: Set<number>; sub?: boolean }) {
  const groups = [
    { key: "TL", title: "Team Lead", list: members.filter((m) => m.teamRole === "TL") },
    { key: "EXECUTIVE", title: "Executives", list: members.filter((m) => m.teamRole === "EXECUTIVE") },
  ];
  return (
    <div className="p-5">
      {sub && <h4 className="mb-3 text-sm font-semibold text-slate-800">{name} <span className="font-normal text-slate-400">· {members.length} {members.length === 1 ? "member" : "members"}</span></h4>}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.title}</p>
            {g.list.length === 0 ? (
              <p className="text-sm text-slate-400">None yet</p>
            ) : (
              <ul className="space-y-1.5">
                {g.list.map((m) => (
                  <li key={m.id} className="flex items-center gap-2.5">
                    <Avatar name={`${m.staff.firstName} ${m.staff.lastName}`} size={26} />
                    <Link href={`/admin/staff/${m.staff.id}`} className="flex-1 text-sm text-slate-800 hover:text-primary">
                      {m.staff.firstName} {m.staff.lastName}
                      {!m.staff.active && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                    </Link>
                    {!locked.has(m.staff.id) && <ConfirmButton action={removeDepartmentMember} hidden={{ id: m.id }} label="Remove" confirmLabel="Confirm" variant="ghost" className="px-2! py-1! text-xs" />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <ActionForm action={addDepartmentMember} resetOnSuccess className="mt-4 border-t border-slate-100 pt-4">
        <input type="hidden" name="departmentId" value={id} />
        <div className="flex flex-wrap items-center gap-2">
          <select name="staffId" required defaultValue="" className="input w-auto min-w-0 flex-1" aria-label={`Staff member to add to ${name}`}>
            <option value="" disabled>Add someone…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select name="teamRole" defaultValue="EXECUTIVE" className="input w-auto" aria-label="Team role">
            {TEAM_ROLES.map((r) => <option key={r.key} value={r.key}>{r.key === "TL" ? "TL" : r.label}</option>)}
          </select>
          <SubmitButton variant="secondary">Add</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
