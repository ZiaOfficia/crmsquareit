/* Tax invoice maths and formatting. Shared by the form (browser), the server actions and the PDF,
   so the totals the user sees while typing are exactly what gets saved and printed. */

export type TaxInvoiceItem = {
  name: string;
  description?: string;
  qty: number;
  unit: string;
  price: number;
  /** Discount in percent. */
  discount: number;
  /** GST rate in percent, e.g. 18. */
  taxRate: number;
};

export type TaxLine = { label: string; amount: number };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const itemAmount = (i: TaxInvoiceItem) => round2((i.qty || 0) * (i.price || 0) * (1 - (i.discount || 0) / 100));

/** Same state as the seller → CGST + SGST (half each); otherwise IGST. */
export const isIntraState = (placeOfSupply: string, sellerState: string) =>
  placeOfSupply.trim().toLowerCase() === sellerState.trim().toLowerCase();

const pct = (n: number) => `${n.toFixed(2)}%`;

export function invoiceTotals(items: TaxInvoiceItem[], placeOfSupply: string, sellerState: string) {
  const subtotal = round2(items.reduce((s, i) => s + itemAmount(i), 0));
  const byRate = new Map<number, number>();
  for (const i of items) if (i.taxRate > 0) byRate.set(i.taxRate, (byRate.get(i.taxRate) ?? 0) + itemAmount(i));
  const intra = isIntraState(placeOfSupply, sellerState);
  const taxes: TaxLine[] = [];
  for (const [rate, base] of [...byRate].sort((a, b) => a[0] - b[0])) {
    if (intra) {
      const half = round2((base * rate) / 200);
      taxes.push({ label: `CGST @ ${pct(rate / 2)}`, amount: half }, { label: `SGST @ ${pct(rate / 2)}`, amount: half });
    } else taxes.push({ label: `IGST @ ${pct(rate)}`, amount: round2((base * rate) / 100) });
  }
  const taxTotal = round2(taxes.reduce((s, t) => s + t.amount, 0));
  return { subtotal, taxes, taxTotal, total: round2(subtotal + taxTotal) };
}

/** "₹ 69,390.00" */
export const inr = (n: number) =>
  `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "31-10-2026" (India time, so a date picked in the form never shifts a day). */
export function dmy(d: Date | string | null | undefined) {
  if (!d) return "";
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(d));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}-${g("month")}-${g("year")}`;
}

/** Indian financial year (April–March) of a date, as "26-27". */
export function financialYear(d: Date) {
  const ist = new Date(d.getTime() + 5.5 * 3600000);
  const y = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${String(y % 100).padStart(2, "0")}-${String((y + 1) % 100).padStart(2, "0")}`;
}

export const invoiceNumber = (prefix: string, fy: string, seq: number) => `${prefix}/${fy}/${String(seq).padStart(3, "0")}`;

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const three = (n: number) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : "", two(n % 100)].filter(Boolean).join(" ");

function indianWords(n: number) {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1000;
  if (crore) parts.push(`${crore >= 100 ? indianWords(crore) : two(crore)} ${crore === 1 ? "Crore" : "Crores"}`);
  if (lakh) parts.push(`${two(lakh)} ${lakh === 1 ? "Lakh" : "Lakhs"}`);
  if (thousand) parts.push(`${two(thousand)} ${thousand === 1 ? "Thousand" : "Thousands"}`);
  if (rest) parts.push(three(rest));
  return parts.join(" ");
}

/** "INR Eighty One Thousands Eight Hundred Eighty and Twenty Paise Only" — same wording as the template. */
export function amountInWords(amount: number) {
  const paise = Math.round(round2(amount) * 100);
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  return `INR ${indianWords(rupees)}${p ? ` and ${two(p)} Paise` : ""} Only`;
}

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

/** Parses the hidden "items" JSON field posted by the form. */
export function parseTaxItems(raw: unknown): TaxInvoiceItem[] {
  try {
    const arr = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<TaxInvoiceItem>[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((i) => i && String(i.name ?? "").trim())
      .map((i) => ({
        name: String(i.name).trim(),
        description: i.description ? String(i.description).trim() : "",
        qty: Number(i.qty) || 0,
        unit: String(i.unit ?? "").trim(),
        price: Number(i.price) || 0,
        discount: Math.min(100, Math.max(0, Number(i.discount) || 0)),
        taxRate: Math.max(0, Number(i.taxRate) || 0),
      }));
  } catch {
    return [];
  }
}
