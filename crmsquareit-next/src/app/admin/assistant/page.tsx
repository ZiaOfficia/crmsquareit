import { Bot, FileText, Radio, StickyNote } from "lucide-react";
import { requireAdminOrHR } from "@/lib/auth";
import { getNotes } from "@/lib/assistant/notes";
import { allChunks } from "@/lib/assistant/knowledge";
import { fmtDateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/client";
import { deleteAssistantNote, saveAssistantNote } from "./actions";

export const metadata = { title: "Teach the assistant" };

export default async function AssistantKnowledgePage() {
  await requireAdminOrHR();
  const [notes, chunks] = await Promise.all([getNotes(), allChunks()]);
  const guides = chunks.filter((c) => c.source === "guide");
  const live = chunks.filter((c) => c.source === "live");
  const topics = [...new Set(guides.map((g) => g.title.split(" › ")[0]))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teach the assistant"
        subtitle="The assistant answers staff questions about this CRM only, from the knowledge below. Add notes for company rules or anything new, and it starts using them straight away."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Add a note">
            <ActionForm action={saveAssistantNote} resetOnSuccess savedText="Saved. The assistant knows this now." className="space-y-3 p-4">
              <div>
                <span className="label">Title</span>
                <input name="title" required maxLength={160} placeholder="e.g. Leave rules for interns" className="input" />
              </div>
              <div>
                <span className="label">What the assistant should know</span>
                <textarea
                  name="content"
                  required
                  rows={6}
                  maxLength={6000}
                  placeholder={"Write it the way you'd explain it to a new joiner, e.g.\nInterns get 1 casual leave per month. They apply in My HR → Apply for leave like everyone else, and their TL must be told on WhatsApp too."}
                  className="input"
                />
              </div>
              <SubmitButton>Save note</SubmitButton>
            </ActionForm>
          </Card>

          <Card title={`Notes from management (${notes.length})`}>
            {notes.length === 0 ? (
              <EmptyState title="No notes yet" text="Notes are the quickest way to teach the assistant company rules and processes that aren't in the built-in guides." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {notes.map((n) => (
                  <li key={n.id} className="px-4 py-3">
                    <details>
                      <summary className="flex cursor-pointer list-none items-start gap-3">
                        <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{n.title}</p>
                          <p className="line-clamp-2 text-xs text-slate-500">{n.content}</p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {n.by || "Someone"} · {fmtDateTime(n.updatedAt)}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-primary">Edit</span>
                      </summary>
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <ActionForm action={saveAssistantNote} savedText="Saved." className="space-y-3">
                          <input type="hidden" name="id" value={n.id} />
                          <input name="title" required maxLength={160} defaultValue={n.title} className="input" />
                          <textarea name="content" required rows={6} maxLength={6000} defaultValue={n.content} className="input" />
                          <div className="flex items-center gap-2">
                            <SubmitButton>Save changes</SubmitButton>
                          </div>
                        </ActionForm>
                        <div className="mt-2">
                          <ConfirmButton action={deleteAssistantNote} hidden={{ id: n.id }} label="Delete note" />
                        </div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="What it already knows">
            <div className="space-y-4 p-4 text-sm">
              <div className="flex gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-ink">Built-in guides · {guides.length} sections</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {topics.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-400">Kept in the code (src/knowledge). Updated by the developer when features change.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Radio className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <div>
                  <p className="font-medium text-ink">Live from the CRM · refreshed every 5 minutes</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {live.map((c) => (
                      <li key={c.id}>{c.title.replace(" (live)", "")}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-400">Plus, for each person: their access, open tasks, follow-ups, attendance and leave balance.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <p className="text-xs text-slate-500">
                  It only answers questions about this CRM, can't change anything itself, and never shares passwords or salaries. Staff open it with the “Ask assistant” button at the bottom right of every page.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
