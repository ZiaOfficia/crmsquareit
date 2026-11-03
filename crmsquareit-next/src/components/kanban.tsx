"use client";
import Link from "next/link";
import { useOptimistic, useTransition, useState } from "react";
import clsx from "clsx";

export type KanbanCard = { id: number; columnId: number | string; title: string; subtitle?: string; meta?: string; href: string; accent?: string };
export type KanbanColumn = { id: number | string; name: string; color: string };

/** Generic drag-and-drop board (native HTML5 DnD). */
export function Kanban({ columns, cards, onMove }: { columns: KanbanColumn[]; cards: KanbanCard[]; onMove: (id: number, columnId: never) => Promise<void> }) {
  const [optimistic, setOptimistic] = useOptimistic(cards, (state, { id, columnId }: { id: number; columnId: number | string }) =>
    state.map((c) => (c.id === id ? { ...c, columnId } : c))
  );
  const [, start] = useTransition();
  const [over, setOver] = useState<number | string | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const list = optimistic.filter((c) => c.columnId === col.id);
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = Number(e.dataTransfer.getData("text/plain"));
              const card = optimistic.find((c) => c.id === id);
              if (!card || card.columnId === col.id) return;
              start(async () => {
                setOptimistic({ id, columnId: col.id });
                await onMove(id, col.id as never);
              });
            }}
            className={clsx("flex w-72 shrink-0 flex-col rounded-xl bg-slate-100/80 transition", over === col.id && "ring-2 ring-primary/40")}
          >
            <div className="flex items-center gap-2 rounded-t-xl border-t-4 px-3 py-3" style={{ borderColor: col.color }}>
              <span className="text-sm font-semibold text-slate-700">{col.name}</span>
              <span className="rounded-full bg-white px-2 text-xs font-medium text-slate-500">{list.length}</span>
            </div>
            <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-3">
              {list.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(c.id))}
                  className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
                  style={c.accent ? { borderLeft: `3px solid ${c.accent}` } : undefined}
                >
                  <Link href={c.href} className="block text-sm font-medium text-slate-800 hover:text-primary">{c.title}</Link>
                  {c.subtitle && <p className="mt-0.5 text-xs text-slate-500">{c.subtitle}</p>}
                  {c.meta && <p className="mt-2 text-xs font-medium text-slate-600">{c.meta}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
