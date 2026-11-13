import type { TaxInvoiceItem } from "@/lib/tax-invoice";

/* Complete sample invoices for the "Fill example" buttons. They fill every field so anyone can see what goes where,
   then overwrite the details. One per GST case: same state (CGST + SGST), other state (IGST), several items. */

export type TaxInvoiceExample = {
  key: string;
  label: string;
  hint: string;
  billName: string;
  billAddress: string;
  billGstin: string;
  /** Empty → "Ship to the same name and address". */
  shipName: string;
  shipAddress: string;
  placeOfSupply: string;
  items: TaxInvoiceItem[];
};

export const TAX_INVOICE_EXAMPLES: TaxInvoiceExample[] = [
  {
    key: "same-state",
    label: "Same state (CGST + SGST)",
    hint: "Client in Uttar Pradesh, so the 18% GST is split into 9% CGST + 9% SGST.",
    billName: "Shield Defence Academy",
    billAddress: "Beg Tower, Opp. Indira Diagnostic Centre, Faizabad Road, Indiranagar, Lucknow-226016 UP,",
    billGstin: "09ECLPS5523R1ZJ",
    shipName: "",
    shipAddress: "",
    placeOfSupply: "Uttar Pradesh",
    items: [{ name: "Search engine marketing", description: "", qty: 1, unit: "OTH", price: 69390, discount: 0, taxRate: 18 }],
  },
  {
    key: "other-state",
    label: "Other state (IGST)",
    hint: "Client in Delhi, so the full 18% is charged as IGST.",
    billName: "Bluestone Realty Pvt Ltd",
    billAddress: "4th Floor, Ansal Bhawan, 16 Kasturba Gandhi Marg, Connaught Place, New Delhi-110001",
    billGstin: "07AAHCB4521K1Z8",
    shipName: "",
    shipAddress: "",
    placeOfSupply: "Delhi",
    items: [
      { name: "Website development", description: "10-page responsive website with CMS", qty: 1, unit: "OTH", price: 45000, discount: 10, taxRate: 18 },
      { name: "Domain & hosting", description: "1 year, SSL included", qty: 1, unit: "YRS", price: 6000, discount: 0, taxRate: 18 },
    ],
  },
  {
    key: "retainer",
    label: "Monthly retainer, separate ship-to",
    hint: "Several items with units and a discount, billed to the head office but delivered to a branch.",
    billName: "Avadh Healthcare LLP",
    billAddress: "12 Vidhan Sabha Marg, Hazratganj, Lucknow-226001 UP",
    billGstin: "09AAKFA7788M1Z3",
    shipName: "Avadh Healthcare – Gomti Nagar Branch",
    shipAddress: "B-2/45 Vibhuti Khand, Gomti Nagar, Lucknow-226010 UP",
    placeOfSupply: "Uttar Pradesh",
    items: [
      { name: "Social media management", description: "Instagram + Facebook, 16 posts and 4 reels a month", qty: 1, unit: "MON", price: 25000, discount: 0, taxRate: 18 },
      { name: "Google Ads management", description: "Campaign setup, optimisation and monthly report", qty: 1, unit: "MON", price: 15000, discount: 5, taxRate: 18 },
      { name: "Photo shoot", description: "Half-day shoot at the clinic, 40 edited photos", qty: 4, unit: "HRS", price: 2500, discount: 0, taxRate: 18 },
    ],
  },
];
