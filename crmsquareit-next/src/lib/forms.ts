/** Small helpers for reading FormData in server actions. */
export const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
export const reqStr = (f: FormData, k: string) => str(f, k) ?? "";
export const num = (f: FormData, k: string, d = 0) => {
  const v = str(f, k);
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};
export const intOrNull = (f: FormData, k: string) => {
  const v = str(f, k);
  const n = v === null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
export const dateOrNull = (f: FormData, k: string) => {
  const v = str(f, k);
  return v ? new Date(v) : null;
};
export const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true" || f.get(k) === "1";
export const ints = (f: FormData, k: string) =>
  f.getAll(k).map((v) => parseInt(String(v), 10)).filter((n) => Number.isFinite(n));

export type ActionState = { error?: string; ok?: boolean } | undefined;
