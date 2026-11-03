import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { addNote, deleteNote } from "@/app/admin/shared-actions";
import { Avatar, Card } from "./ui";
import { ConfirmButton, SubmitButton } from "./client";

export async function Notes({ relType, relId, path }: { relType: string; relId: number; path: string }) {
  const notes = await db.note.findMany({ where: { relType, relId }, orderBy: { createdAt: "desc" }, include: { staff: true } });
  return (
    <Card title={`Notes (${notes.length})`}>
      <form action={addNote} className="space-y-2 border-b border-slate-100 p-4">
        <input type="hidden" name="relType" value={relType} />
        <input type="hidden" name="relId" value={relId} />
        <input type="hidden" name="path" value={path} />
        <textarea name="content" rows={3} required placeholder="Write a note…" className="input" />
        <div className="flex justify-end">
          <SubmitButton>Add note</SubmitButton>
        </div>
      </form>
      <ul className="divide-y divide-slate-100">
        {notes.map((n) => (
          <li key={n.id} className="flex gap-3 px-5 py-4">
            <Avatar name={n.staff ? `${n.staff.firstName} ${n.staff.lastName}` : "?"} size={30} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{n.staff ? `${n.staff.firstName} ${n.staff.lastName}` : "Deleted user"}</span> · {fmtDateTime(n.createdAt)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{n.content}</p>
            </div>
            <ConfirmButton action={deleteNote} hidden={{ id: n.id, path }} label="✕" confirmLabel="Delete?" variant="ghost" className="px-2 py-1 text-xs" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
