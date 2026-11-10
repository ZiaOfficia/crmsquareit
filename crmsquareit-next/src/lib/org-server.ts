import "server-only";
import { db } from "./db";

/** Members can only sit in a department that has no sub-departments
 *  (e.g. SMM / SEM, not "Paid Advertising" itself; whether there is a shared
 *  level above them is still a pending decision). */
export async function checkAssignableDepartment(departmentId: number) {
  const d = await db.orgDepartment.findUnique({ where: { id: departmentId }, include: { _count: { select: { children: true } } } });
  if (!d || !d.active) return { error: "That department no longer exists." } as const;
  if (d._count.children > 0) return { error: `Assign people to a sub-department of ${d.name}, not to ${d.name} itself.` } as const;
  return { department: d } as const;
}

/** Active departments people can be placed in, in tree order, labelled with their parent. */
export async function assignableDepartments() {
  const top = await db.orgDepartment.findMany({
    where: { active: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    include: { children: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });
  return top.flatMap((d) =>
    d.children.length ? d.children.map((c) => ({ id: c.id, label: `${d.name} › ${c.name}` })) : [{ id: d.id, label: d.name }]
  );
}
