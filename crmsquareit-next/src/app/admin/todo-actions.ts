"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function addTodo(f: FormData) {
  const user = await requireUser();
  const text = String(f.get("text") || "").trim();
  if (text) await db.todo.create({ data: { staffId: user.id, text } });
  revalidatePath("/admin");
}
export async function toggleTodo(id: number) {
  const user = await requireUser();
  const t = await db.todo.findFirst({ where: { id, staffId: user.id } });
  if (t) await db.todo.update({ where: { id }, data: { done: !t.done } });
  revalidatePath("/admin");
}
export async function deleteTodo(id: number) {
  const user = await requireUser();
  await db.todo.deleteMany({ where: { id, staffId: user.id } });
  revalidatePath("/admin");
}
