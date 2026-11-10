"use client";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { btn } from "@/components/ui";
import { markAllRead, markRead } from "./actions";

export function MarkReadButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => markRead(id))} className={btn("secondary", "px-2.5 py-1 text-xs")}>
      <Check className="h-3.5 w-3.5" /> Mark as read
    </button>
  );
}

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => markAllRead())} className={btn("secondary")}>
      <Check className="h-4 w-4" /> Mark all as read
    </button>
  );
}
