"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdminOrHR } from "@/lib/auth";
import { reqStr, type ActionState } from "@/lib/forms";
import { logActivity } from "@/lib/activity";
import { getNotes, saveNotes } from "@/lib/assistant/notes";

const MAX_NOTES = 200;

/** Add a note, or update one when an id is posted. */
export async function saveAssistantNote(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireAdminOrHR();
  const id = reqStr(f, "id");
  const title = reqStr(f, "title").slice(0, 160);
  const content = reqStr(f, "content").slice(0, 6000);
  if (!title) return { error: "Give the note a short title, e.g. “Leave rules for interns”." };
  if (!content) return { error: "Write what the assistant should know." };
  const notes = await getNotes();
  const entry = { id: id || randomUUID(), title, content, updatedAt: new Date().toISOString(), by: `${user.firstName} ${user.lastName}`.trim() };
  const i = notes.findIndex((n) => n.id === id);
  if (id && i < 0) return { error: "That note no longer exists." };
  if (!id && notes.length >= MAX_NOTES) return { error: `You can keep up to ${MAX_NOTES} notes. Delete old ones first.` };
  if (i >= 0) notes[i] = entry;
  else notes.unshift(entry);
  await saveNotes(notes);
  await logActivity("assistant", 0, `${i >= 0 ? "updated" : "added"} assistant note “${title}”`, user.id);
  revalidatePath("/admin/assistant");
  return { ok: true };
}

export async function deleteAssistantNote(f: FormData) {
  const user = await requireAdminOrHR();
  const id = String(f.get("id") ?? "");
  const notes = await getNotes();
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  await saveNotes(notes.filter((n) => n.id !== id));
  await logActivity("assistant", 0, `deleted assistant note “${note.title}”`, user.id);
  revalidatePath("/admin/assistant");
}
