import "server-only";
import { getSettings, saveSettings } from "../settings";

/** Something a Super Admin or HR taught the assistant ("Teach the assistant" page). */
export type AssistantNote = { id: string; title: string; content: string; updatedAt: string; by: string };

/** Notes are stored as JSON in the settings table, so no database migration is needed. */
export async function getNotes(): Promise<AssistantNote[]> {
  const raw = (await getSettings()).assistant_notes;
  try {
    const list = JSON.parse(raw || "[]");
    return Array.isArray(list) ? list.filter((n) => n && typeof n.title === "string" && typeof n.content === "string") : [];
  } catch {
    return [];
  }
}

export async function saveNotes(notes: AssistantNote[]) {
  await saveSettings({ assistant_notes: JSON.stringify(notes) });
}
