"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function addNote(f: FormData) {
  const user = await requireUser();
  const content = String(f.get("content") || "").trim();
  const relType = String(f.get("relType"));
  const relId = Number(f.get("relId"));
  if (content && relId) await db.note.create({ data: { relType, relId, content, staffId: user.id } });
  revalidatePath(String(f.get("path") || "/admin").split("?")[0]);
}

export async function deleteNote(f: FormData) {
  const user = await requireUser();
  const id = Number(f.get("id"));
  const note = await db.note.findUnique({ where: { id } });
  if (note && (user.isAdmin || note.staffId === user.id)) await db.note.delete({ where: { id } });
  revalidatePath(String(f.get("path") || "/admin").split("?")[0]);
}
