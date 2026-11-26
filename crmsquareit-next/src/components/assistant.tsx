"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { BookOpen, Bot, RotateCcw, Send, Sparkles, Square, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };
const STORE = "crm-assistant-chat";

/** Floating "Ask the assistant" chat, on every CRM page. */
export function AssistantWidget({ firstName, suggestions, canTeach }: { firstName: string; suggestions: string[]; canTeach: boolean }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Keep the conversation while moving between pages (this browser tab only).
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) || "[]");
      if (Array.isArray(saved)) setMsgs(saved.filter((m) => !m.error));
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    if (busy) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-30)));
    } catch {
      /* storage unavailable */
    }
  }, [msgs, busy]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [msgs, open]);
  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs.filter((m) => !m.error), { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const put = (content: string, error = false) =>
      setMsgs((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: "assistant", content, error };
        return copy;
      });
    try {
      const res = await fetch("/admin/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        put(data.error || "Something went wrong. Please try again.", true);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        put(acc);
      }
      if (!acc.trim()) put("I couldn't come up with an answer. Please rephrase the question.", true);
    } catch (e) {
      if ((e as Error).name !== "AbortError") put("Couldn't reach the assistant. Check your connection and try again.", true);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  const stop = () => abort.current?.abort();
  const reset = () => {
    stop();
    setMsgs([]);
  };

  return (
    <div className="no-print">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
          aria-label="Open CRM assistant"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Ask assistant</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100vh-40px))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Squareit Assistant</p>
              <p className="truncate text-xs text-slate-500">Answers about this CRM only</p>
            </div>
            {canTeach && (
              <Link href="/admin/assistant" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary" title="Teach the assistant">
                <BookOpen className="h-4 w-4" />
              </Link>
            )}
            {msgs.length > 0 && (
              <button onClick={reset} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary" title="New conversation">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {msgs.length === 0 && (
              <div>
                <p className="text-sm text-slate-700">
                  Hi {firstName}! Ask me anything about Squareit CRM: how to do something, what a screen means, or what to do when something goes wrong.
                </p>
                <p className="mt-1 text-xs text-slate-400">English, Hindi or Hinglish, all fine.</p>
                <div className="mt-4 space-y-2">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-primary/40 hover:bg-primary/5">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-white">{m.content}</div>
                </div>
              ) : (
                <div key={i} className="flex">
                  <div className={clsx("max-w-[92%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm", m.error ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-800")}>
                    {m.content ? <Markdown text={m.content} onLink={() => setOpen(false)} /> : <Dots />}
                  </div>
                </div>
              )
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-end gap-2 border-t border-slate-100 p-3"
          >
            <textarea
              ref={box}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Ask how to do something…"
              className="input max-h-32 min-h-[40px] flex-1 resize-none"
            />
            {busy ? (
              <button type="button" onClick={stop} className="rounded-xl bg-slate-200 p-2.5 text-slate-700 hover:bg-slate-300" title="Stop">
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="rounded-xl bg-primary p-2.5 text-white disabled:opacity-40" title="Send">
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

function Dots() {
  return (
    <span className="flex gap-1 py-1.5">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

/* ── Tiny markdown: paragraphs, lists, headings, **bold**, `code`, [links](/admin/…) ── */

function Markdown({ text, onLink }: { text: string; onLink: () => void }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={clsx("my-1 space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, onLink)}</li>
        ))}
      </Tag>
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    blocks.push(
      <p key={blocks.length} className={clsx("my-1", h && "font-semibold text-ink")}>
        {inline(h ? h[1] : line, onLink)}
      </p>
    );
  }
  flush();
  return <div className="leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{blocks}</div>;
}

function inline(text: string, onLink: () => void): ReactNode {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const k = parts.length;
    if (m[1]) {
      // Only links inside the CRM; anything else is shown as plain text.
      parts.push(
        m[2].startsWith("/admin") ? (
          <Link key={k} href={m[2]} onClick={onLink} className="font-medium text-primary underline underline-offset-2">
            {m[1]}
          </Link>
        ) : (
          <Fragment key={k}>{m[1]}</Fragment>
        )
      );
    } else if (m[3]) parts.push(<strong key={k} className="font-semibold">{m[3]}</strong>);
    else parts.push(<code key={k} className="rounded bg-white px-1 py-0.5 text-[12px]">{m[4]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
