/* Demo data: a running digital/IT agency, for showing the CRM.
   Runs once (guarded by the "demo_data" setting) and only ADDS rows; it never deletes or edits existing data.
   Trigger: `npm run db:demo`, or set SEED_DEMO=1 on Vercel and redeploy (the build runs prisma/seed.ts).
   Demo logins: <firstname>@demo.squareit.in / demo123 (see the list printed at the end). */
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { QUOTATION_EXAMPLES } from "../src/app/admin/quotations/examples";

const DAY = 86_400_000;
const MARKER = "demo_data";
const PASSWORD = "demo123";
const DOMAIN = "demo.squareit.in";

const now = new Date();
const days = (n: number, h = 11, m = 0) => {
  const d = new Date(now.getTime() + n * DAY);
  d.setUTCHours(h - 5, m - 30, 0, 0); // h:m IST
  return d;
};
/** Calendar date (for @db.Date columns). */
const dateOnly = (n: number) => {
  const d = new Date(now.getTime() + n * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
const hash = () => randomBytes(16).toString("hex");
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const pick = <T,>(arr: readonly T[], i: number) => arr[i % arr.length];

type P = { key: string; first: string; last: string; dept: string; role: "TL" | "EXECUTIVE"; title: string; salary: number; gender: "Male" | "Female" };
const PEOPLE: P[] = [
  { key: "ananya", first: "Ananya", last: "Kapoor", dept: "HR", role: "TL", title: "HR Manager", salary: 55000, gender: "Female" },
  { key: "ritika", first: "Ritika", last: "Joshi", dept: "HR", role: "EXECUTIVE", title: "HR Executive", salary: 26000, gender: "Female" },
  { key: "karan", first: "Karan", last: "Malhotra", dept: "BDE", role: "TL", title: "Business Development Manager", salary: 60000, gender: "Male" },
  { key: "sana", first: "Sana", last: "Qureshi", dept: "BDE", role: "EXECUTIVE", title: "Business Development Executive", salary: 28000, gender: "Female" },
  { key: "aditya", first: "Aditya", last: "Rao", dept: "BDE", role: "EXECUTIVE", title: "Business Development Executive", salary: 27000, gender: "Male" },
  { key: "vivek", first: "Vivek", last: "Nair", dept: "WEB_DEV", role: "TL", title: "Tech Lead", salary: 80000, gender: "Male" },
  { key: "imran", first: "Imran", last: "Shaikh", dept: "WEB_DEV", role: "EXECUTIVE", title: "Full-stack Developer", salary: 45000, gender: "Male" },
  { key: "megha", first: "Megha", last: "Pillai", dept: "WEB_DEV", role: "EXECUTIVE", title: "UI/UX Designer", salary: 38000, gender: "Female" },
  { key: "rohit", first: "Rohit", last: "Bansal", dept: "SEO", role: "TL", title: "SEO Lead", salary: 52000, gender: "Male" },
  { key: "nidhi", first: "Nidhi", last: "Saxena", dept: "SEO", role: "EXECUTIVE", title: "SEO Executive", salary: 25000, gender: "Female" },
  { key: "deepak", first: "Deepak", last: "Yadav", dept: "GBP", role: "TL", title: "Local SEO Lead", salary: 42000, gender: "Male" },
  { key: "farah", first: "Farah", last: "Khan", dept: "GBP", role: "EXECUTIVE", title: "GBP Executive", salary: 22000, gender: "Female" },
  { key: "tanya", first: "Tanya", last: "Arora", dept: "SMM", role: "TL", title: "Social Media Lead", salary: 48000, gender: "Female" },
  { key: "kabir", first: "Kabir", last: "Sethi", dept: "SMM", role: "EXECUTIVE", title: "Content Creator", salary: 26000, gender: "Male" },
  { key: "siddharth", first: "Siddharth", last: "Jain", dept: "SEM", role: "TL", title: "Performance Marketing Lead", salary: 58000, gender: "Male" },
  { key: "aisha", first: "Aisha", last: "Siddiqui", dept: "SEM", role: "EXECUTIVE", title: "Google Ads Executive", salary: 30000, gender: "Female" },
  { key: "manish", first: "Manish", last: "Tiwari", dept: "SMO", role: "TL", title: "SMO Lead", salary: 40000, gender: "Male" },
  { key: "pooja", first: "Pooja", last: "Mishra", dept: "SMO", role: "EXECUTIVE", title: "SMO Executive", salary: 21000, gender: "Female" },
];

const CUSTOMERS = [
  { company: "Sunrise Dental Clinic", city: "Mumbai", state: "Maharashtra", contact: ["Dr. Meera", "Shah"], title: "Owner" },
  { company: "GreenLeaf Organics", city: "Pune", state: "Maharashtra", contact: ["Harsh", "Kulkarni"], title: "Founder" },
  { company: "Urban Fitness Studio", city: "Bengaluru", state: "Karnataka", contact: ["Ria", "Fernandes"], title: "Studio Manager" },
  { company: "Kaveri Textiles", city: "Chennai", state: "Tamil Nadu", contact: ["Senthil", "Kumar"], title: "Director" },
  { company: "BlueWave Travels", city: "Panaji", state: "Goa", contact: ["Joel", "D'Souza"], title: "Partner" },
  { company: "Metro Realty", city: "New Delhi", state: "Delhi", contact: ["Gaurav", "Khanna"], title: "Sales Head" },
  { company: "H.M. Surgical Hospital", city: "Azamgarh", state: "Uttar Pradesh", contact: ["Dr. Farhan", "Ahmad"], title: "Orthopaedic Surgeon" },
  { company: "Spice Route Restaurant", city: "Lucknow", state: "Uttar Pradesh", contact: ["Zoya", "Rizvi"], title: "Owner" },
  { company: "Apex Coaching Centre", city: "Kota", state: "Rajasthan", contact: ["Alok", "Sharma"], title: "Director" },
  { company: "Nova Interiors", city: "Hyderabad", state: "Telangana", contact: ["Lakshmi", "Reddy"], title: "Principal Designer" },
];

const SERVICES = [
  { d: "SEO – monthly retainer", r: 25000 },
  { d: "Google Ads management", r: 18000 },
  { d: "Website development", r: 85000 },
  { d: "Social media management", r: 20000 },
  { d: "Google Business Profile optimisation", r: 8000 },
  { d: "Annual maintenance (AMC)", r: 12000 },
] as const;

export async function seedDemo(db: PrismaClient) {
  if (await db.setting.findUnique({ where: { key: MARKER } })) {
    console.log("Demo data: already added before, skipping.");
    return;
  }
  // Marked first so a later build never adds a second copy, even if this run stops halfway.
  await db.setting.create({ data: { key: MARKER, value: `started ${now.toISOString()}` } });

  const admin = (await db.staff.findFirst({ where: { isAdmin: true }, orderBy: { id: "asc" } }))!;
  await db.staff.update({ where: { id: admin.id }, data: { lastLogin: days(0, 9, 40) } });
  const pw = await bcrypt.hash(PASSWORD, 10);
  const employeeRole = await db.role.findFirst({ where: { name: "Employee" } });
  const depts = Object.fromEntries((await db.orgDepartment.findMany()).map((d) => [d.code, d]));

  /* ── Staff, departments, HR records ── */
  const S: Record<string, { id: number; first: string }> = {};
  for (const [i, p] of PEOPLE.entries()) {
    const email = `${p.key}@${DOMAIN}`;
    const existing = await db.staff.findUnique({ where: { email } });
    const s =
      existing ??
      (await db.staff.create({
        data: {
          firstName: p.first, lastName: p.last, email, password: pw, roleId: employeeRole?.id, phone: `+91 9${String(812345670 + i * 7919).slice(0, 9)}`,
          employeeCode: `SQ-${String(101 + i)}`, designation: p.title, joinDate: dateOnly(-(90 + i * 41)), gender: p.gender, monthlySalary: p.salary,
          dob: new Date(Date.UTC(1990 + (i % 9), i % 12, 3 + i)), address: `${pick(["Gomti Nagar", "Hazratganj", "Aliganj", "Indira Nagar"], i)}, Lucknow`,
          bankName: pick(["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank"], i), bankAccount: `5010${String(31415926 + i * 2711)}`, bankIfsc: pick(["HDFC0001234", "ICIC0004321", "SBIN0005678", "UTIB0000987"], i),
          lastLogin: i % 6 === 5 ? days(-1, 18, 10) : days(0, 9, 5 + i * 2),
        },
      }));
    S[p.key] = { id: s.id, first: p.first };
    const dept = depts[p.dept];
    if (dept) await db.departmentMember.upsert({ where: { staffId_departmentId: { staffId: s.id, departmentId: dept.id } }, update: {}, create: { staffId: s.id, departmentId: dept.id, teamRole: p.role } });
  }
  const id = (k: string) => S[k].id;
  const log = (relType: string, relId: number, description: string, who: number, at: Date) => db.activity.create({ data: { relType, relId, description, staffId: who, createdAt: at } });

  /* ── Catalogue ── */
  for (const s of SERVICES) if (!(await db.item.findFirst({ where: { description: s.d } }))) await db.item.create({ data: { description: s.d, rate: s.r, taxRate: 18 } });

  /* ── Customers ── */
  const C: { id: number; company: string; contactId: number }[] = [];
  for (const [i, c] of CUSTOMERS.entries()) {
    const slug = c.company.toLowerCase().replace(/[^a-z]/g, "");
    const cust = await db.customer.create({
      data: {
        company: c.company, city: c.city, state: c.state, country: "India", currency: "INR", phone: `+91 98${String(30011223 + i * 104729).slice(0, 8)}`,
        website: `https://${slug}.in`, address: `${12 + i * 7}, Main Road`, createdAt: days(-(170 - i * 14)),
        contacts: { create: { firstName: c.contact[0], lastName: c.contact[1], email: `contact@${slug}.in`, phone: `+91 99${String(55501234 + i * 7717).slice(0, 8)}`, title: c.title, isPrimary: true } },
      },
      include: { contacts: true },
    });
    C.push({ id: cust.id, company: cust.company, contactId: cust.contacts[0].id });
  }
  const cust = (name: string) => C.find((c) => c.company === name)!;

  /* ── Leads + follow-ups (BDE) ── */
  const statuses = await db.leadStatus.findMany({ orderBy: { order: "asc" } });
  const st = (name: string) => statuses.find((s) => s.name === name) ?? statuses[0];
  const sources = await db.leadSource.findMany();
  const src = (name: string) => sources.find((s) => s.name === name)?.id ?? sources[0]?.id;
  const LEADS = [
    { name: "Dr. Anjali Verma", company: "Verma Eye Care", city: "Lucknow", value: 45000, status: "Proposal sent", temp: "HOT", src: "Website", who: "sana", last: -2, next: 1, desc: "Wants a clinic website with appointment booking and Google reviews widget." },
    { name: "Rajesh Gupta", company: "Gupta Sweets", city: "Kanpur", value: 30000, status: "Contacted", temp: "HOT", src: "Referral", who: "aditya", last: -1, next: 2, desc: "Instagram + Google Business for 3 outlets." },
    { name: "Priyanka Singh", company: "Bloom Boutique", city: "Varanasi", value: 60000, status: "Qualified", temp: "HOT", src: "Instagram", who: "sana", last: -3, next: 0, desc: "Shopify store with 200 products, wants SMM retainer after launch." },
    { name: "Mohit Agarwal", company: "Agarwal Builders", city: "Noida", value: 120000, status: "Proposal sent", temp: "HOT", src: "Google Ads", who: "karan", last: -4, next: 2, desc: "Real estate lead-gen: landing pages + Meta and Google Ads." },
    { name: "Shabnam Ali", company: "Noor Bridal Studio", city: "Lucknow", value: 25000, status: "New", temp: null, src: "Facebook", who: "aditya", last: null, next: 1, desc: "Asked about Instagram reels package." },
    { name: "Arvind Menon", company: "Menon Physiotherapy", city: "Kochi", value: 35000, status: "Contacted", temp: "COLD", src: "Website", who: "sana", last: -9, next: -1, desc: "Comparing with a local freelancer. Price sensitive." },
    { name: "Kunal Bhatia", company: "FitFuel Cafe", city: "Chandigarh", value: 40000, status: "Qualified", temp: "HOT", src: "Referral", who: "aditya", last: -2, next: 3, desc: "Website + Zomato listing optimisation + SMM." },
    { name: "Sunita Devi", company: "Shri Ram Public School", city: "Azamgarh", value: 55000, status: "New", temp: null, src: "Cold call", who: "sana", last: null, next: 0, desc: "School website with admission enquiry form." },
    { name: "Farukh Siddiqui", company: "Royal Biryani House", city: "Lucknow", value: 28000, status: "Contacted", temp: "COLD", src: "Google Ads", who: "aditya", last: -11, next: -3, desc: "Wants more Swiggy orders; discussed Google Ads + GBP." },
    { name: "Neeraj Chauhan", company: "Chauhan Motors", city: "Meerut", value: 75000, status: "Proposal sent", temp: "HOT", src: "Website", who: "karan", last: -1, next: 4, desc: "Two-wheeler dealership: website, GBP for 2 showrooms, lead ads." },
    { name: "Ayesha Khan", company: "Glow Skin Clinic", city: "Bhopal", value: 50000, status: "Qualified", temp: "HOT", src: "Instagram", who: "sana", last: -5, next: 1, desc: "Dermatology clinic, wants before/after gallery and Meta ads." },
    { name: "Tarun Mehra", company: "Mehra Logistics", city: "Ludhiana", value: 20000, status: "Contacted", temp: "COLD", src: "Cold call", who: "aditya", last: -15, next: null, desc: "Only wants a basic company profile site." },
  ];
  const leadIds: Record<string, number> = {};
  for (const [i, l] of LEADS.entries()) {
    const lead = await db.lead.create({
      data: {
        name: l.name, company: l.company, city: l.city, country: "India", value: l.value, description: l.desc, statusId: st(l.status).id, sourceId: src(l.src), assignedId: id(l.who),
        email: `${l.name.split(" ").slice(-1)[0].toLowerCase()}@${l.company.toLowerCase().replace(/[^a-z]/g, "")}.com`, phone: `+91 97${String(11002200 + i * 99991).slice(0, 8)}`,
        temperature: l.temp, lastContact: l.last === null ? null : days(l.last, 15), nextFollowUp: l.next === null ? null : days(l.next, 11), createdAt: days(-(20 + i * 3), 10),
      },
    });
    leadIds[l.company] = lead.id;
    if (l.last !== null) {
      await db.followUp.create({ data: { leadId: lead.id, staffId: id(l.who), channel: "CALL", note: "Intro call, shared portfolio and pricing.", outcome: null, createdAt: days(l.last - 4, 12) } });
      await db.followUp.create({
        data: { leadId: lead.id, staffId: id(l.who), channel: pick(["WHATSAPP", "MEETING", "EMAIL", "CALL"], i), note: l.temp === "HOT" ? "Interested, asked for a detailed quotation." : "Not ready yet, follow up next month.", outcome: l.temp, nextDate: l.next === null ? null : days(l.next, 11), createdAt: days(l.last, 15) },
      });
    }
  }
  // Two leads that already became customers.
  for (const [company, customer] of [["Spice Route Restaurant", "Spice Route Restaurant"], ["Nova Interiors", "Nova Interiors"]] as const) {
    const lead = await db.lead.create({ data: { name: CUSTOMERS.find((c) => c.company === customer)!.contact.join(" "), company, city: CUSTOMERS.find((c) => c.company === customer)!.city, value: 60000, statusId: st("Customer").id, sourceId: src("Referral"), assignedId: id("karan"), customerId: cust(customer).id, temperature: "HOT", lastContact: days(-30), createdAt: days(-60) } });
    await db.followUp.create({ data: { leadId: lead.id, staffId: id("karan"), channel: "MEETING", note: "Signed. Advance received.", outcome: "HOT", createdAt: days(-30) } });
  }

  /* ── Quotations (from the built-in examples) ── */
  const qStart = ((await db.quotation.findFirst({ orderBy: { number: "desc" }, select: { number: true } }))?.number ?? 0) + 1;
  const qPlan = [
    { ex: 0, status: "ACCEPTED", customer: "H.M. Surgical Hospital", lead: null, by: "karan", ago: -24 },
    { ex: 1, status: "SENT", customer: null, lead: "Bloom Boutique", by: "sana", ago: -3 },
    { ex: 2, status: "ACCEPTED", customer: "Spice Route Restaurant", lead: null, by: "karan", ago: -32 },
    { ex: 0, status: "SENT", customer: null, lead: "Verma Eye Care", by: "sana", ago: -2 },
    { ex: 1, status: "DRAFT", customer: null, lead: "Chauhan Motors", by: "karan", ago: -1 },
  ];
  for (const [i, q] of qPlan.entries()) {
    const ex = QUOTATION_EXAMPLES[q.ex % QUOTATION_EXAMPLES.length].draft;
    const lead = q.lead ? LEADS.find((l) => l.company === q.lead)! : null;
    const items = ex.services.map((s, k) => ({ description: s.title, longDescription: s.points || null, qty: 1, rate: s.fee, taxRate: s.taxRate, tag: s.tag || null, note: s.note || null, sortOrder: k }));
    const subtotal = items.reduce((a, x) => a + x.rate, 0);
    const taxTotal = items.reduce((a, x) => a + (x.rate * x.taxRate) / 100, 0);
    const client = lead ? { name: lead.name, company: lead.company, email: null, phone: null, address: `${lead.city}, India` } : ex.client;
    const quote = await db.quotation.create({
      data: {
        number: qStart + i, subject: ex.subject, subtitle: ex.subtitle, status: q.status, date: days(q.ago, 12), validUntil: days(q.ago + 15),
        customerId: q.customer ? cust(q.customer).id : null, leadId: lead ? leadIds[lead.company] : null,
        clientName: client.name, clientCompany: q.customer ?? client.company, clientEmail: client.email || null, clientPhone: client.phone || null, clientAddress: client.address || null,
        subtotal, taxTotal, total: subtotal + taxTotal, intro: ex.intro, scopeIntro: ex.scopeIntro, scope: ex.scope, steps: ex.steps, terms: ex.terms, closing: ex.closing,
        createdById: id(q.by), createdAt: days(q.ago, 12), items: { create: items },
      },
    });
    if (q.status === "ACCEPTED" && q.customer)
      await db.customerPayment.create({ data: { customerId: cust(q.customer).id, quotationId: quote.id, type: "ADVANCE", amount: Math.round((subtotal + taxTotal) / 2), mode: "UPI", date: days(q.ago + 2), reference: `UPI${400000 + i * 137}`, staffId: id(q.by) } });
    await log("quotation", quote.id, `created quotation for ${q.customer ?? lead?.company}`, id(q.by), days(q.ago, 12));
  }

  /* ── Projects, tasks, follow-ups, comments, timesheets ── */
  const PROJECTS = [
    { key: "hm", name: "H.M. Surgical – website & local SEO", customer: "H.M. Surgical Hospital", status: "IN_PROGRESS", start: -20, end: 10, members: ["vivek", "imran", "megha", "rohit", "deepak"], desc: "7-page orthopaedic website with appointment form, WhatsApp CTA and Azamgarh local SEO." },
    { key: "spice", name: "Spice Route – digital marketing retainer", customer: "Spice Route Restaurant", status: "IN_PROGRESS", start: -30, end: 60, members: ["tanya", "kabir", "siddharth", "aisha", "deepak", "farah"], desc: "Instagram + Facebook content, Google Ads for delivery orders, GBP for 2 outlets." },
    { key: "sunrise", name: "Sunrise Dental – SEO retainer", customer: "Sunrise Dental Clinic", status: "IN_PROGRESS", start: -75, end: 105, members: ["rohit", "nidhi"], desc: "Monthly SEO: technical fixes, 4 blogs/month, local citations." },
    { key: "nova", name: "Nova Interiors – portfolio website", customer: "Nova Interiors", status: "IN_PROGRESS", start: -12, end: 18, members: ["vivek", "megha", "imran"], desc: "Image-led portfolio site with project gallery and enquiry form." },
    { key: "metro", name: "Metro Realty – lead generation ads", customer: "Metro Realty", status: "ON_HOLD", start: -40, end: 20, members: ["siddharth", "aisha"], desc: "Meta lead ads + Google search for 2 residential projects. Paused until new creatives are approved." },
    { key: "greenleaf", name: "GreenLeaf – Shopify store", customer: "GreenLeaf Organics", status: "FINISHED", start: -120, end: -35, members: ["vivek", "imran", "megha"], desc: "Shopify store with 120 products, Razorpay and Shiprocket." },
  ];
  const Pj: Record<string, number> = {};
  for (const p of PROJECTS) {
    const pr = await db.project.create({
      data: { name: p.name, customerId: cust(p.customer).id, status: p.status, startDate: days(p.start), deadline: days(p.end), description: p.desc, billingType: "FIXED", progress: p.status === "FINISHED" ? 100 : 0, members: { connect: p.members.map((k) => ({ id: id(k) })) }, createdAt: days(p.start) },
    });
    Pj[p.key] = pr.id;
    await log("project", pr.id, `created project ${p.name}`, admin.id, days(p.start));
  }

  type T = { n: string; p?: string; by: string; to: string[]; s: string; pr: string; due: number | null; watch?: string[]; done?: number; c?: [string, string][]; hrs?: number; d?: string };
  const TASKS: T[] = [
    // Web development — Vivek (TL) → Imran, Megha
    { n: "Homepage design – H.M. Surgical", p: "hm", by: "vivek", to: ["megha"], s: "COMPLETE", pr: "HIGH", due: -6, done: -5, hrs: 9, c: [["megha", "Uploaded the final homepage design in Figma."], ["vivek", "Approved. Client liked the hero section."]] },
    { n: "Build appointment form + WhatsApp CTA", p: "hm", by: "vivek", to: ["imran"], s: "IN_PROGRESS", pr: "URGENT", due: 2, watch: ["ananya"], hrs: 6, c: [["imran", "Form done, testing email delivery to the hospital inbox."]], d: "Form fields: name, mobile, preferred date, concern. Send to email + WhatsApp." },
    { n: "Services & conditions pages", p: "hm", by: "vivek", to: ["imran", "megha"], s: "IN_PROGRESS", pr: "HIGH", due: 4, hrs: 5 },
    { n: "Speed optimisation – Lighthouse 90+", p: "hm", by: "vivek", to: ["imran"], s: "NOT_STARTED", pr: "MEDIUM", due: 8 },
    { n: "Nova Interiors – gallery layout", p: "nova", by: "vivek", to: ["megha"], s: "AWAITING_FEEDBACK", pr: "MEDIUM", due: 1, hrs: 7, c: [["megha", "Sent 2 layout options to the client on WhatsApp."]] },
    { n: "Nova Interiors – CMS setup", p: "nova", by: "vivek", to: ["imran"], s: "NOT_STARTED", pr: "MEDIUM", due: 9 },
    { n: "Fix checkout bug on GreenLeaf (COD fee)", p: "greenleaf", by: "vivek", to: ["imran"], s: "TESTING", pr: "URGENT", due: -1, watch: ["ananya"], hrs: 3, c: [["imran", "Patched the shipping rule; waiting for the client to confirm on live."]] },
    { n: "Code review: appointment form", p: "hm", by: "vivek", to: ["vivek"], s: "NOT_STARTED", pr: "MEDIUM", due: 3 },
    { n: "Learn Next.js image optimisation", by: "imran", to: ["imran"], s: "IN_PROGRESS", pr: "LOW", due: 6 },
    // SEO — Rohit (TL) → Nidhi
    { n: "Sunrise Dental – November blog posts (4)", p: "sunrise", by: "rohit", to: ["nidhi"], s: "IN_PROGRESS", pr: "MEDIUM", due: 5, hrs: 8, c: [["nidhi", "2 of 4 published, 3rd in review."]] },
    { n: "Sunrise Dental – monthly SEO report", p: "sunrise", by: "rohit", to: ["rohit"], s: "NOT_STARTED", pr: "HIGH", due: 3, watch: ["ananya"] },
    { n: "Fix 404s and redirect chains", p: "sunrise", by: "rohit", to: ["nidhi"], s: "COMPLETE", pr: "HIGH", due: -4, done: -3, hrs: 4 },
    { n: "H.M. Surgical – on-page SEO for all pages", p: "hm", by: "rohit", to: ["nidhi"], s: "NOT_STARTED", pr: "HIGH", due: 7 },
    { n: "Keyword research – Azamgarh orthopaedics", p: "hm", by: "rohit", to: ["nidhi"], s: "COMPLETE", pr: "MEDIUM", due: -8, done: -7, hrs: 3 },
    { n: "Local citations for Sunrise Dental (20)", p: "sunrise", by: "nidhi", to: ["nidhi"], s: "IN_PROGRESS", pr: "LOW", due: -2 },
    // GBP — Deepak (TL) → Farah
    { n: "Spice Route – GBP posts (weekly)", p: "spice", by: "deepak", to: ["farah"], s: "IN_PROGRESS", pr: "MEDIUM", due: 1 },
    { n: "Verify GBP for H.M. Surgical", p: "hm", by: "deepak", to: ["farah"], s: "AWAITING_FEEDBACK", pr: "HIGH", due: -2, c: [["farah", "Verification postcard requested, waiting for the code from the hospital."]] },
    { n: "Reply to Google reviews – Spice Route", p: "spice", by: "deepak", to: ["farah"], s: "COMPLETE", pr: "LOW", due: -1, done: -1 },
    // SMM — Tanya (TL) → Kabir
    { n: "December content calendar – Spice Route", p: "spice", by: "tanya", to: ["kabir"], s: "IN_PROGRESS", pr: "HIGH", due: 3, watch: ["ananya"], hrs: 5 },
    { n: "Shoot 6 reels at Spice Route", p: "spice", by: "tanya", to: ["kabir"], s: "NOT_STARTED", pr: "HIGH", due: 5, d: "Biryani making, chef intro, customer reactions. Book the shoot with Zoya." },
    { n: "Instagram insights report – October", p: "spice", by: "tanya", to: ["tanya"], s: "COMPLETE", pr: "MEDIUM", due: -10, done: -9 },
    { n: "Festive post designs (Christmas, New Year)", p: "spice", by: "tanya", to: ["kabir"], s: "NOT_STARTED", pr: "MEDIUM", due: 10 },
    // SEM — Siddharth (TL) → Aisha
    { n: "Spice Route – Google Ads search campaign", p: "spice", by: "siddharth", to: ["aisha"], s: "IN_PROGRESS", pr: "HIGH", due: 2, hrs: 4, c: [["aisha", "Campaign live. CTR 6.2%, cost per order ₹38 so far."]] },
    { n: "Metro Realty – new ad creatives brief", p: "metro", by: "siddharth", to: ["aisha"], s: "AWAITING_FEEDBACK", pr: "MEDIUM", due: -3, watch: ["ananya"] },
    { n: "Weekly ads report to clients", by: "siddharth", to: ["siddharth"], s: "NOT_STARTED", pr: "MEDIUM", due: 1 },
    { n: "Negative keyword cleanup", p: "spice", by: "aisha", to: ["aisha"], s: "COMPLETE", pr: "LOW", due: -2, done: -2 },
    // SMO — Manish (TL) → Pooja
    { n: "Quora & Pinterest profiles for Nova Interiors", p: "nova", by: "manish", to: ["pooja"], s: "IN_PROGRESS", pr: "LOW", due: 6 },
    { n: "Directory submissions – H.M. Surgical", p: "hm", by: "manish", to: ["pooja"], s: "NOT_STARTED", pr: "MEDIUM", due: -1 },
    // BDE — Karan (TL) → Sana, Aditya
    { n: "Send revised quotation to Chauhan Motors", by: "karan", to: ["karan"], s: "IN_PROGRESS", pr: "URGENT", due: 0, watch: ["ananya"] },
    { n: "Follow up: Verma Eye Care proposal", by: "karan", to: ["sana"], s: "NOT_STARTED", pr: "HIGH", due: 1 },
    { n: "Prepare case study deck for clinics", by: "karan", to: ["aditya", "sana"], s: "IN_PROGRESS", pr: "MEDIUM", due: 4 },
    { n: "Call 10 cold leads from Google Ads", by: "aditya", to: ["aditya"], s: "COMPLETE", pr: "MEDIUM", due: -1, done: -1 },
    // HR / Super Admin
    { n: "Onboarding kit for new joiners", by: "ananya", to: ["ritika"], s: "IN_PROGRESS", pr: "MEDIUM", due: 5 },
    { n: "Process November payroll", by: "ananya", to: ["ananya"], s: "NOT_STARTED", pr: "HIGH", due: 6 },
    { n: "Renew office internet plan", by: "ananya", to: ["ritika"], s: "COMPLETE", pr: "LOW", due: -4, done: -4 },
    { n: "Quarterly review with department TLs", by: "admin", to: ["vivek", "rohit", "tanya", "siddharth", "karan"], s: "NOT_STARTED", pr: "HIGH", due: 7, d: "Each TL: 5 slides – wins, delays, client feedback, hiring needs." },
  ];
  const who = (k: string) => (k === "admin" ? admin.id : id(k));
  for (const [i, t] of TASKS.entries()) {
    const projectId = t.p ? Pj[t.p] : null;
    const created = days(Math.min(-3, (t.due ?? 0) - 6 - (i % 4)), 10, 15);
    const task = await db.task.create({
      data: {
        name: t.n, description: t.d ?? null, status: t.s, priority: t.pr, startDate: created, dueDate: t.due === null ? null : days(t.due, 18),
        projectId, customerId: t.p ? cust(PROJECTS.find((p) => p.key === t.p)!.customer).id : null, createdById: who(t.by), createdAt: created,
        completedAt: t.s === "COMPLETE" ? days(t.done ?? -1, 17) : null,
        assignees: { connect: t.to.map((k) => ({ id: who(k) })) }, watchers: { connect: (t.watch ?? []).map((k) => ({ id: who(k) })).concat(t.watch ? [{ id: admin.id }] : []) },
      },
    });
    for (const [j, [k, text]] of (t.c ?? []).entries()) await db.taskComment.create({ data: { taskId: task.id, staffId: who(k), content: text, createdAt: days(-2 + j, 13 + j) } });
    for (let h = 0, left = t.hrs ?? 0; left > 0; h++, left -= 3) {
      const start = days(-(h + 1), 10 + (h % 3) * 2);
      await db.timeEntry.create({ data: { taskId: task.id, staffId: who(t.to[0]), startTime: start, endTime: new Date(start.getTime() + Math.min(3, left) * 3600_000) } });
    }
    await log("task", task.id, `created task ${t.n}`, who(t.by), created);
    if (t.s === "COMPLETE") await log("task", task.id, `moved task ${t.n} to complete`, who(t.to[0]), days(t.done ?? -1, 17));
  }
  for (const [key, pid] of Object.entries(Pj)) {
    const all = await db.task.findMany({ where: { projectId: pid }, select: { status: true } });
    if (all.length && key !== "greenleaf") await db.project.update({ where: { id: pid }, data: { progress: Math.round((all.filter((x) => x.status === "COMPLETE").length / all.length) * 100) } });
  }

  /* ── To-do lists ── */
  const TODOS: Record<string, [string, boolean][]> = {
    vivek: [["Review Imran's PR for the appointment form", false], ["Plan sprint for Nova Interiors", false], ["Renew GitHub Team seats", true]],
    imran: [["Test form on iPhone Safari", false], ["Push hotfix to GreenLeaf", true], ["Write README for H.M. project", false]],
    megha: [["Export gallery mockups as PNG", false], ["Collect brand fonts from Nova", true]],
    rohit: [["Check Search Console for Sunrise", false], ["Prepare SEO audit template", false], ["Team stand-up notes", true]],
    nidhi: [["Publish blog #3 for Sunrise", false], ["Submit sitemap after redirects", true], ["Find 5 more citation sites", false]],
    deepak: [["Call H.M. Surgical for GBP code", false], ["Plan GBP posts for next week", true]],
    farah: [["Upload 10 new photos to Spice Route GBP", false], ["Reply to 3 new reviews", true]],
    tanya: [["Approve December calendar", false], ["Book reel shoot slot", false], ["Share October report with client", true]],
    kabir: [["Write captions for 6 reels", false], ["Buy ring light batteries", true], ["Edit chef intro reel", false]],
    siddharth: [["Increase Spice Route budget by 10%", false], ["Call Metro Realty about creatives", false]],
    aisha: [["Add call extensions", true], ["Check conversion tracking", false]],
    manish: [["Assign Pinterest boards to Pooja", true], ["Find 15 directories for H.M.", false]],
    pooja: [["Create Quora profile for Nova", false], ["Pin 20 interior images", false]],
    karan: [["Send Chauhan Motors revised quote", false], ["Weekly BDE review with Sana & Aditya", false], ["Update lead sheet", true]],
    sana: [["Call Dr. Anjali at 11 am", false], ["Send portfolio to Bloom Boutique", true], ["Follow up Glow Skin Clinic", false]],
    aditya: [["Visit Gupta Sweets on Friday", false], ["Share reel samples with Noor Bridal", false], ["Log yesterday's calls", true]],
    ananya: [["Approve Pooja's leave", false], ["Payroll inputs from TLs", false], ["Book team lunch venue", true]],
    ritika: [["Order ID cards for 2 new joiners", false], ["Update attendance for Monday", true]],
  };
  for (const [k, list] of Object.entries(TODOS))
    for (const [j, [text, done]] of list.entries()) await db.todo.create({ data: { staffId: id(k), text, done, createdAt: days(-j, 9 + j) } });

  /* ── Invoices + payments (last 6 months) ── */
  let invNo = ((await db.invoice.findFirst({ orderBy: { number: "desc" }, select: { number: true } }))?.number ?? 0) + 1;
  const INV = [
    { c: "GreenLeaf Organics", s: [2, 5], st: "PAID", ago: -150 }, { c: "Sunrise Dental Clinic", s: [0], st: "PAID", ago: -140 },
    { c: "Urban Fitness Studio", s: [3, 4], st: "PAID", ago: -120 }, { c: "Sunrise Dental Clinic", s: [0], st: "PAID", ago: -110 },
    { c: "Kaveri Textiles", s: [1], st: "PAID", ago: -95 }, { c: "GreenLeaf Organics", s: [2], st: "PAID", ago: -80 },
    { c: "Sunrise Dental Clinic", s: [0], st: "PAID", ago: -80 }, { c: "BlueWave Travels", s: [3, 1], st: "PAID", ago: -62 },
    { c: "Sunrise Dental Clinic", s: [0], st: "PAID", ago: -50 }, { c: "Metro Realty", s: [1], st: "PARTIAL", ago: -45 },
    { c: "Spice Route Restaurant", s: [3, 1, 4], st: "PAID", ago: -30 }, { c: "Sunrise Dental Clinic", s: [0], st: "PAID", ago: -20 },
    { c: "H.M. Surgical Hospital", s: [2], st: "PARTIAL", ago: -18 }, { c: "Kaveri Textiles", s: [5], st: "UNPAID", ago: -35 },
    { c: "Spice Route Restaurant", s: [3, 1], st: "UNPAID", ago: -5 }, { c: "Nova Interiors", s: [2], st: "UNPAID", ago: -10 },
    { c: "Urban Fitness Studio", s: [4], st: "DRAFT", ago: -1 },
  ];
  for (const [i, v] of INV.entries()) {
    const lines = v.s.map((k, j) => ({ description: SERVICES[k].d, qty: 1, rate: SERVICES[k].r, taxRate: 18, sortOrder: j }));
    const subtotal = lines.reduce((a, l) => a + l.rate, 0);
    const tax = Math.round(subtotal * 0.18 * 100) / 100;
    const date = days(v.ago, 12);
    const inv = await db.invoice.create({
      data: {
        number: invNo++, customerId: cust(v.c).id, date, dueDate: new Date(date.getTime() + 15 * DAY), status: v.st, subtotal, taxTotal: tax, total: subtotal + tax,
        hash: hash(), clientNote: "Thank you for your business.", terms: "Payment due within 15 days. Bank: HDFC Bank, A/c 50200012345678, IFSC HDFC0001234.",
        sentAt: v.st === "DRAFT" ? null : date, createdAt: date, items: { create: lines },
      },
    });
    const mode = pick(["Bank transfer", "UPI", "Bank transfer", "Cheque"], i);
    if (v.st === "PAID") await db.payment.create({ data: { invoiceId: inv.id, amount: inv.total, mode, date: days(v.ago + 6 + (i % 5)), transactionId: `TXN${880000 + i * 313}` } });
    if (v.st === "PARTIAL") await db.payment.create({ data: { invoiceId: inv.id, amount: Math.round(inv.total / 2), mode, date: days(v.ago + 4), transactionId: `TXN${880000 + i * 313}` } });
    await log("invoice", inv.id, `created invoice for ${v.c}`, admin.id, date);
  }
  await db.estimate.create({
    data: {
      number: ((await db.estimate.findFirst({ orderBy: { number: "desc" }, select: { number: true } }))?.number ?? 0) + 1, customerId: cust("Apex Coaching Centre").id, date: days(-4), expiryDate: days(11),
      status: "SENT", subtotal: 105000, taxTotal: 18900, total: 123900, hash: hash(), items: { create: [{ description: "Website development", qty: 1, rate: 85000, taxRate: 18 }, { description: "Social media management", qty: 1, rate: 20000, taxRate: 18 }] },
    },
  });

  /* ── Expenses ── */
  const cats = await db.expenseCategory.findMany();
  const cat = (n: string) => (cats.find((c) => c.name === n) ?? cats[0]).id;
  const EXP = [
    ["SEMrush subscription", "Software", 9999, -3], ["Meta ads – Spice Route (billable)", "Advertising", 15000, -6], ["Figma Professional", "Software", 3600, -12],
    ["Google Workspace (18 users)", "Software", 2650 * 4, -15], ["Client visit – Azamgarh", "Travel", 4200, -19], ["Stock photos – Nova Interiors", "Software", 2400, -9],
  ] as const;
  for (const [name, c, amount, ago] of EXP) await db.expense.create({ data: { name, categoryId: cat(c), amount, date: days(ago), paymentMode: "Card", billable: name.includes("billable") } });

  /* ── Office expenses (HR) ── */
  const hrId = id("ananya");
  const OFFICE = [
    ["Office rent", "RENT", 45000, 1, "Sharma Properties"], ["Electricity bill", "ELECTRICITY", 6840, 6, "UPPCL"], ["Airtel fibre 300 Mbps", "INTERNET", 2359, 4, "Airtel"],
    ["Printer paper & pens", "SUPPLIES", 1280, 8, "Gupta Stationers"], ["Tea, coffee & snacks", "PANTRY", 3450, 10, "Local store"], ["Housekeeping – monthly", "CLEANING", 7000, 2, "CleanPro Services"],
    ["AC servicing (3 units)", "MAINTENANCE", 2700, 12, "CoolCare"], ["Team lunch – Diwali", "WELFARE", 9800, 3, "Spice Route Restaurant"],
  ] as const;
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  for (const base of [lastMonth, thisMonth]) {
    for (const [title, category, amount, day, paidTo] of OFFICE) {
      const date = new Date(base.getTime() + (day - 1) * DAY + 6 * 3600_000);
      if (date > now) continue;
      await db.officeExpense.create({ data: { title, category, amount, date, paidTo, paymentMode: amount > 5000 ? "Bank transfer" : "UPI", createdById: hrId } });
    }
  }
  const lmKey = monthKey(lastMonth);
  if (!(await db.officeExpenseReport.findUnique({ where: { month: lmKey } }))) {
    const lm = await db.officeExpense.aggregate({ where: { date: { gte: lastMonth, lt: thisMonth } }, _sum: { amount: true }, _count: true });
    await db.officeExpenseReport.create({ data: { month: lmKey, status: "APPROVED", total: lm._sum.amount ?? 0, count: lm._count, note: "All bills attached in the shared folder.", submittedById: hrId, submittedAt: new Date(thisMonth.getTime() + DAY), reviewedById: admin.id, reviewedAt: new Date(thisMonth.getTime() + 2 * DAY), reviewNote: "Approved." } });
  }

  /* ── Support tickets ── */
  const supportDept = await db.department.findFirst({ where: { name: "Technical" } });
  const TICKETS = [
    { c: "GreenLeaf Organics", s: "COD fee not applied at checkout", m: "Customers choosing Cash on Delivery are not being charged the ₹40 COD fee since yesterday.", pr: "URGENT", st: "IN_PROGRESS", to: "imran", r: [["imran", "We found the issue in the shipping rule and have deployed a fix. Please place a test COD order and confirm."]] },
    { c: "Sunrise Dental Clinic", s: "Add new doctor to the team page", m: "Dr. Kavita Rao has joined. Please add her profile and photo (attached on email).", pr: "LOW", st: "OPEN", to: "megha", r: [] },
    { c: "Spice Route Restaurant", s: "Instagram post went out with wrong price", m: "Yesterday's post shows the biryani combo at ₹249, it should be ₹299.", pr: "HIGH", st: "ANSWERED", to: "kabir", r: [["kabir", "Apologies! The post is corrected and a story has been added with the right price."]] },
    { c: "Urban Fitness Studio", s: "Website contact form emails going to spam", m: "Enquiries from the website land in our Gmail spam folder.", pr: "MEDIUM", st: "CLOSED", to: "imran", r: [["imran", "We set up SPF/DKIM for your domain. Emails now land in the inbox."]] },
  ] as const;
  for (const [i, t] of TICKETS.entries()) {
    const c = cust(t.c);
    const created = days(-(1 + i * 3), 11);
    await db.ticket.create({
      data: {
        subject: t.s, message: t.m, customerId: c.id, contactId: c.contactId, departmentId: supportDept?.id, priority: t.pr, status: t.st, assignedId: id(t.to), createdAt: created,
        lastReply: t.r.length ? days(-(i * 3), 15) : null, replies: { create: t.r.map(([k, msg]) => ({ staffId: id(k), message: msg, createdAt: days(-(i * 3), 15) })) },
      },
    });
  }

  /* ── Announcements ── */
  const everyone = Object.values(S).map((s) => s.id);
  const ANN = [
    { title: "Welcome to the new Squareit CRM", message: "All tasks, to-dos, leads and attendance now live here. TLs: assign work to your team from Tasks. Please mark your attendance daily.", audience: "ALL", pinned: true, urgent: false, by: admin.id, ago: -6, depts: [] as string[] },
    { title: "Office closed on Friday for Guru Nanak Jayanti", message: "The office will remain closed. Client-facing teams please inform clients in advance.", audience: "ALL", pinned: false, urgent: true, by: hrId, ago: -2, depts: [] },
    { title: "Code freeze for H.M. Surgical launch", message: "No changes to the H.M. Surgical site after Thursday 6 pm unless Vivek approves.", audience: "DEPARTMENTS", pinned: false, urgent: false, by: admin.id, ago: -1, depts: ["WEB_DEV", "SEO"] },
  ];
  for (const a of ANN) {
    const ann = await db.announcement.create({
      data: { title: a.title, message: a.message, audience: a.audience, pinned: a.pinned, urgent: a.urgent, createdById: a.by, createdAt: days(a.ago, 10), departments: { connect: a.depts.filter((c) => depts[c]).map((c) => ({ id: depts[c].id })) } },
    });
    const readers = everyone.filter((_, i) => (i + a.ago) % 3 !== 0);
    await db.announcementRead.createMany({ data: readers.map((staffId) => ({ announcementId: ann.id, staffId, readAt: days(a.ago, 12) })), skipDuplicates: true });
  }

  /* ── Attendance (last 3 weeks, Mon–Sat), leave, holidays, payslips ── */
  for (const [i, p] of PEOPLE.entries()) {
    for (let n = 21; n >= 0; n--) {
      const date = dateOnly(-n);
      if (date.getUTCDay() === 0) continue;
      if (n === 0 && i % 5 === 4) continue; // a few haven't marked today yet
      const r = (i * 7 + n * 3) % 23;
      const status = r === 0 ? "ABSENT" : r === 1 ? "LEAVE" : r === 2 ? "HALF_DAY" : r === 3 || r === 4 ? "WFH" : "PRESENT";
      const inMin = 9 * 60 + 25 + ((i * 11 + n * 7) % 35);
      const checkIn = status === "ABSENT" || status === "LEAVE" ? null : new Date(date.getTime() + (inMin - 330) * 60_000);
      const checkOut = checkIn && n > 0 ? new Date(checkIn.getTime() + (status === "HALF_DAY" ? 4.5 : 9) * 3600_000) : null;
      await db.attendance.upsert({ where: { staffId_date: { staffId: id(p.key), date } }, update: {}, create: { staffId: id(p.key), date, status, checkIn, checkOut, markedById: hrId } });
    }
  }
  const LEAVES = [
    { k: "pooja", type: "CASUAL", from: 3, to: 4, st: "PENDING", reason: "Cousin's wedding in Prayagraj." },
    { k: "kabir", type: "SICK", from: 1, to: 1, st: "PENDING", reason: "Fever, will share a doctor's note." },
    { k: "megha", type: "EARNED", from: -9, to: -8, st: "APPROVED", reason: "Family trip." },
    { k: "aditya", type: "CASUAL", from: -15, to: -15, st: "REJECTED", reason: "Personal work.", note: "Client meeting that day, please pick another date." },
  ];
  for (const l of LEAVES)
    await db.leaveRequest.create({
      data: { staffId: id(l.k), type: l.type, fromDate: dateOnly(l.from), toDate: dateOnly(l.to), days: l.to - l.from + 1, reason: l.reason, status: l.st, reviewedById: l.st === "PENDING" ? null : hrId, reviewedAt: l.st === "PENDING" ? null : days(l.from - 3), reviewNote: l.note ?? null, createdAt: days(Math.min(l.from - 5, -1)) },
    });
  const y = now.getUTCFullYear();
  for (const [m, d, name] of [[11, 25, "Christmas"], [0, 1, "New Year's Day"], [0, 26, "Republic Day"], [2, 4, "Holi"]] as const) {
    const date = new Date(Date.UTC(m < now.getUTCMonth() ? y + 1 : y, m, d));
    await db.holiday.upsert({ where: { date }, update: {}, create: { date, name } });
  }
  const pm = monthKey(lastMonth);
  for (const [i, p] of PEOPLE.entries()) {
    const lop = i % 7 === 3 ? 1 : 0;
    const lopAmount = Math.round((p.salary / 26) * lop);
    const bonus = p.dept === "BDE" && p.role === "TL" ? 5000 : 0;
    await db.payslip.upsert({
      where: { staffId_month: { staffId: id(p.key), month: pm } }, update: {},
      create: { staffId: id(p.key), month: pm, salary: p.salary, workingDays: 26, lopDays: lop, lopAmount, bonus, deduction: 200, net: p.salary - lopAmount + bonus - 200, status: "PAID", paidAt: new Date(thisMonth.getTime() + 6 * DAY), note: bonus ? "Target bonus" : null },
    });
  }

  await db.setting.update({ where: { key: MARKER }, data: { value: `done ${new Date().toISOString()}` } });
  console.log(`Demo data added: ${PEOPLE.length} staff, ${C.length} customers, ${LEADS.length + 2} leads, ${qPlan.length} quotations, ${PROJECTS.length} projects, ${TASKS.length} tasks, ${INV.length} invoices.`);
  console.log(`Demo logins (password ${PASSWORD}): ${PEOPLE.map((p) => `${p.key}@${DOMAIN} (${p.dept} ${p.role === "TL" ? "TL" : "Exec"})`).join(", ")}`);
}
