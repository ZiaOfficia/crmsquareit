/* Seeds required lookup data + the first admin account.
   Run `npm run db:demo` to also add sample customers, leads, invoices etc. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { ORG_STRUCTURE } from "../src/lib/org";

const db = new PrismaClient();
const hash = () => randomBytes(16).toString("hex");
const days = (n: number) => new Date(Date.now() + n * 86400000);

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@squareit.in";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  if ((await db.staff.count()) === 0) {
    await db.staff.create({
      data: { firstName: "Super", lastName: "Admin", email, password: await bcrypt.hash(password, 10), isAdmin: true },
    });
    console.log(`Admin created → ${email} / ${password}  (change this after first login!)`);
  }

  if ((await db.role.count()) === 0) {
    const all = ["view", "create", "edit", "delete"];
    await db.role.createMany({
      data: [
        { name: "Manager", permissions: JSON.stringify({ customers: all, leads: all, invoices: all, estimates: all, payments: all, expenses: all, projects: all, tasks: all, tickets: all, reports: ["view"] }) },
        { name: "Sales", permissions: JSON.stringify({ customers: ["view", "create", "edit"], leads: all, estimates: ["view", "create", "edit"], invoices: ["view"] }) },
        { name: "Employee", permissions: JSON.stringify({ customers: ["view"], projects: ["view"], tasks: ["view", "create", "edit"], tickets: ["view", "create", "edit"] }) },
      ],
    });
  }

  if ((await db.leadStatus.count()) === 0) {
    await db.leadStatus.createMany({
      data: [
        { name: "New", color: "#4f74c4", order: 1, isDefault: true },
        { name: "Contacted", color: "#0f9fb0", order: 2 },
        { name: "Qualified", color: "#e0a400", order: 3 },
        { name: "Proposal sent", color: "#7c5cc4", order: 4 },
        { name: "Customer", color: "#27ae57", order: 5 },
      ],
    });
  }
  if ((await db.leadSource.count()) === 0)
    await db.leadSource.createMany({ data: ["Website", "Google Ads", "Facebook", "Instagram", "Referral", "Cold call"].map((name) => ({ name })) });
  if ((await db.tax.count()) === 0)
    await db.tax.createMany({ data: [{ name: "GST", rate: 18 }, { name: "GST", rate: 12 }, { name: "GST", rate: 5 }] });
  if ((await db.paymentMode.count()) === 0)
    await db.paymentMode.createMany({ data: ["Bank transfer", "UPI", "Cash", "Cheque", "Card"].map((name) => ({ name })) });
  if ((await db.expenseCategory.count()) === 0)
    await db.expenseCategory.createMany({ data: ["Software", "Advertising", "Office", "Travel", "Salaries", "Utilities"].map((name) => ({ name })) });
  if ((await db.department.count()) === 0)
    await db.department.createMany({ data: [{ name: "Support" }, { name: "Billing" }, { name: "Technical" }] });

  // Organisation hierarchy: create any missing department by code. Never
  // overwrites existing rows, so renames made in the app are kept.
  for (const [i, d] of ORG_STRUCTURE.entries()) {
    const parent = await db.orgDepartment.upsert({ where: { code: d.code }, update: {}, create: { code: d.code, name: d.name, sortOrder: i + 1 } });
    for (const [j, c] of (d.children ?? []).entries())
      await db.orgDepartment.upsert({ where: { code: c.code }, update: {}, create: { code: c.code, name: c.name, parentId: parent.id, sortOrder: j + 1 } });
  }

  if ((process.env.SEED_DEMO === "1" || process.argv.includes("--demo")) && (await db.customer.count()) === 0) await demo();
}

async function demo() {
  const admin = (await db.staff.findFirst({ where: { isAdmin: true } }))!;
  const role = await db.role.findFirst({ where: { name: "Employee" } });
  const pw = await bcrypt.hash("staff123", 10);
  const priya = await db.staff.create({ data: { firstName: "Priya", lastName: "Sharma", email: "priya@squareit.in", password: pw, roleId: role?.id } });
  const rahul = await db.staff.create({ data: { firstName: "Rahul", lastName: "Verma", email: "rahul@squareit.in", password: pw, roleId: role?.id } });

  const companies = [
    ["Sunrise Dental Clinic", "Mumbai"], ["GreenLeaf Organics", "Pune"], ["Urban Fitness Studio", "Bengaluru"],
    ["Kaveri Textiles", "Chennai"], ["BlueWave Travels", "Goa"], ["Metro Realty", "Delhi"],
  ];
  const customers = [];
  for (const [company, city] of companies) {
    const c = await db.customer.create({
      data: {
        company, city, country: "India", phone: "+91 98" + Math.floor(10000000 + Math.random() * 89999999), website: `https://${company.toLowerCase().replace(/[^a-z]/g, "")}.in`,
        contacts: { create: { firstName: "Contact", lastName: company.split(" ")[0], email: `hello@${company.toLowerCase().replace(/[^a-z]/g, "")}.in`, isPrimary: true } },
      },
    });
    customers.push(c);
  }

  const statuses = await db.leadStatus.findMany();
  const sources = await db.leadSource.findMany();
  const leadNames = ["Amit Patel", "Neha Gupta", "Vikram Singh", "Sneha Iyer", "Arjun Mehta", "Kavya Nair", "Rohan Das", "Pooja Reddy"];
  for (let i = 0; i < leadNames.length; i++)
    await db.lead.create({
      data: {
        name: leadNames[i], company: `${leadNames[i].split(" ")[1]} Enterprises`, email: `${leadNames[i].split(" ")[0].toLowerCase()}@example.com`,
        value: (i + 1) * 15000, statusId: statuses[i % 4].id, sourceId: sources[i % sources.length].id, assignedId: i % 2 ? priya.id : admin.id,
      },
    });

  const services = [
    ["SEO – monthly retainer", 25000], ["Google Ads management", 18000], ["Website redesign", 85000],
    ["Social media management", 20000], ["Google Business Profile optimisation", 8000],
  ] as const;
  for (const [d, r] of services) await db.item.create({ data: { description: d, rate: r, taxRate: 18 } });

  for (let i = 0; i < 10; i++) {
    const c = customers[i % customers.length];
    const lines = [services[i % 5], services[(i + 2) % 5]].map(([d, r], k) => ({ description: d, qty: 1, rate: r, taxRate: 18, sortOrder: k }));
    const subtotal = lines.reduce((s, l) => s + l.rate, 0);
    const tax = subtotal * 0.18;
    const status = ["PAID", "PAID", "UNPAID", "PARTIAL", "DRAFT"][i % 5];
    const date = days(-i * 18);
    const inv = await db.invoice.create({
      data: {
        number: i + 1, customerId: c.id, date, dueDate: new Date(date.getTime() + 15 * 86400000), status,
        subtotal, taxTotal: tax, total: subtotal + tax, hash: hash(), clientNote: "Thank you for your business.",
        items: { create: lines },
      },
    });
    if (status === "PAID") await db.payment.create({ data: { invoiceId: inv.id, amount: inv.total, mode: "Bank transfer", date } });
    if (status === "PARTIAL") await db.payment.create({ data: { invoiceId: inv.id, amount: Math.round(inv.total / 2), mode: "UPI", date } });
  }
  await db.estimate.create({
    data: {
      number: 1, customerId: customers[2].id, date: new Date(), expiryDate: days(15), status: "SENT", subtotal: 85000, taxTotal: 15300, total: 100300, hash: hash(),
      items: { create: [{ description: "Website redesign", qty: 1, rate: 85000, taxRate: 18 }] },
    },
  });

  const proj = await db.project.create({
    data: {
      name: "Website revamp", customerId: customers[0].id, status: "IN_PROGRESS", startDate: days(-10), deadline: days(30), progress: 40,
      description: "Full redesign of the clinic website with booking integration.", members: { connect: [{ id: admin.id }, { id: priya.id }] },
    },
  });
  await db.project.create({ data: { name: "SEO – Q4 campaign", customerId: customers[1].id, status: "NOT_STARTED", startDate: days(2), members: { connect: [{ id: rahul.id }] } } });
  const tasks = [
    ["Collect brand assets", "COMPLETE", "LOW"], ["Wireframes for home page", "IN_PROGRESS", "HIGH"], ["Booking widget integration", "NOT_STARTED", "URGENT"],
    ["Content migration", "NOT_STARTED", "MEDIUM"], ["Client review round 1", "AWAITING_FEEDBACK", "MEDIUM"],
  ];
  for (const [name, status, priority] of tasks)
    await db.task.create({ data: { name, status, priority, projectId: proj.id, dueDate: days(7), createdById: admin.id, assignees: { connect: [{ id: priya.id }] } } });

  const dept = await db.department.findFirst();
  await db.ticket.create({
    data: {
      subject: "Contact form not sending emails", message: "Hi, our website contact form stopped sending emails since yesterday.", customerId: customers[0].id,
      departmentId: dept?.id, priority: "HIGH", status: "OPEN", replies: { create: [] },
    },
  });
  const cat = await db.expenseCategory.findFirst();
  await db.expense.create({ data: { name: "SEMrush subscription", categoryId: cat!.id, amount: 9999, date: days(-3), paymentMode: "Card" } });
  console.log("Demo data added (staff logins: priya@squareit.in / staff123)");
}

main().finally(() => db.$disconnect());
