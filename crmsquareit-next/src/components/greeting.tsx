"use client";

import { useEffect, useState } from "react";

/** Morning before 12:00, afternoon until 17:00, evening after that, by the viewer's own clock. */
function partOfDay(d: Date) {
  const h = d.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

/**
 * "Good morning / afternoon / evening, <name>". It runs in the browser so it
 * follows the viewer's local time, not the server's (often UTC), and refreshes
 * each minute so a tab left open switches over at noon and 5 PM.
 */
export function Greeting({ name, suffix }: { name: string; suffix?: string }) {
  const [part, setPart] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setPart(partOfDay(new Date()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  // Until the browser clock is read, say "Hello" so the server render never shows the wrong time of day.
  return (
    <>
      {part ? `Good ${part}` : "Hello"}, {name}
      {suffix ? ` ${suffix}` : ""}
    </>
  );
}
