/* Seeds required lookup data + the first admin account.
   Run `npm run db:demo` (or set SEED_DEMO=1 on Vercel) to also add the demo agency in prisma/demo.ts. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ORG_STRUCTURE } from "../src/lib/org";
import { seedDemo } from "./demo";

const db = new PrismaClient();

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

  if (process.env.SEED_DEMO === "1" || process.argv.includes("--demo")) {
    // Never fail a deploy because of demo data; the error shows in the build log.
    try {
      await seedDemo(db);
    } catch (e) {
      console.error("Demo data failed:", e);
    }
  }
}

main().finally(() => db.$disconnect());
