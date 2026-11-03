"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { str, reqStr, num, intOrNull, dateOrNull, ints, type ActionState } from "@/lib/forms";

function data(f: FormData) {
  return {
    name: reqStr(f, "name"),
    customerId: intOrNull(f, "customerId") ?? 0,
    status: reqStr(f, "status") || "NOT_STARTED",
    billingType: reqStr(f, "billingType") || "FIXED",
    rate: num(f, "rate"),
    startDate: dateOrNull(f, "startDate") ?? new Date(),
    deadline: dateOrNull(f, "deadline"),
    description: str(f, "description"),
    progress: Math.min(100, Math.max(0, Math.round(num(f, "progress")))),
  };
}

export async function saveProject(id: number | null, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("projects", id ? "edit" : "create");
  const d = data(f);
  if (!d.name || !d.customerId) return { error: "Project name and customer are required." };
  const members = ints(f, "members").map((x) => ({ id: x }));
  const p = id
    ? await db.project.update({ where: { id }, data: { ...d, members: { set: members } } })
    : await db.project.create({ data: { ...d, members: { connect: members } } });
  await logActivity("project", p.id, `${id ? "updated" : "created"} project ${p.name}`, user.id);
  redirect(`/admin/projects/${p.id}`);
}

export async function deleteProject(f: FormData) {
  const user = await requirePerm("projects", "delete");
  const id = Number(f.get("id"));
  const p = await db.project.delete({ where: { id } });
  await logActivity("project", id, `deleted project ${p.name}`, user.id);
  redirect("/admin/projects");
}
