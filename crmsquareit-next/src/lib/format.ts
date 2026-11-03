export function money(n: number | null | undefined, currency = "INR") {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** yyyy-mm-dd for <input type="date"> */
export function inputDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(d);
}

export function humanize(s: string) {
  return s.toLowerCase().split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

export function initials(first: string, last?: string) {
  return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase();
}

export function formatDuration(ms: number) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
