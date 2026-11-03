"use client";
import { useRef, useTransition } from "react";
import { X } from "lucide-react";
import { addTodo, toggleTodo, deleteTodo } from "./todo-actions";
import { Card } from "@/components/ui";

export function TodoWidget({ todos }: { todos: { id: number; text: string; done: boolean }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();
  return (
    <Card title="My to-do list">
      <form
        ref={ref}
        action={async (f) => {
          await addTodo(f);
          ref.current?.reset();
        }}
        className="flex gap-2 border-b border-slate-100 p-4"
      >
        <input name="text" placeholder="Add a to-do and press Enter" className="input" />
      </form>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
        {todos.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">Nothing to do. Nice!</li>}
        {todos.map((t) => (
          <li key={t.id} className="group flex items-center gap-3 px-5 py-2.5">
            <input type="checkbox" checked={t.done} onChange={() => start(() => toggleTodo(t.id))} className="h-4 w-4 rounded accent-[#27ae57]" />
            <span className={`flex-1 text-sm ${t.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{t.text}</span>
            <button onClick={() => start(() => deleteTodo(t.id))} className="text-slate-300 opacity-0 hover:text-brand-red group-hover:opacity-100" aria-label="Delete">
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
