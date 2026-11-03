# Squareit CRM (Next.js rebuild)

A modern rebuild of the old Perfex-based Squareit CRM. It runs on **Next.js 15 (App Router) + TypeScript + Tailwind CSS + Prisma**.
Every dependency is free and open source, with no paid services or licence keys.

## Quick start (Windows / Mac / Linux)

Requires **Node.js 20 or newer** (https://nodejs.org).

```bash
cd crmsquareit-next
copy .env.example .env        # Mac/Linux: cp .env.example .env
npm install
npm run setup                 # creates the database + admin account
npm run dev                   # http://localhost:3000
```

Log in with **admin@squareit.in / admin123**, then change the password from *My profile*.
You can set your own first login before running setup with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars.

Want sample data to click around? Run `npm run db:demo` on an empty database.
To start over completely, delete `prisma/dev.db` and run `npm run setup` again.

## What's included (Phase 1)

| Area | Features |
|---|---|
| **Auth & security** | Email/password login (bcrypt + signed HTTP-only JWT cookie), protected `/admin`, roles with per-module view/create/edit/delete permissions, administrators |
| **Dashboard** | Outstanding/overdue invoices, payments this month, new leads, active projects, 12-month payments vs expenses chart, lead pipeline donut, my tasks, overdue invoices, personal to-do list, activity feed |
| **Leads** | List + drag-and-drop **Kanban**, filters (status/source/assignee), lost/junk, notes, activity log, one-click **convert to customer** (copies notes) |
| **Customers** | Company profile, multiple contacts (primary contact), tabs for invoices/estimates/projects/tickets/notes, billed/paid/outstanding totals |
| **Invoices** | Line-item editor (saved items, per-line GST/tax, discount %, adjustment), auto numbering & prefix, draft → sent → partially paid → paid, overdue detection, payments, duplicate, cancel, print/PDF, **shareable client link** `/invoice/<hash>` |
| **Estimates** | Same editor, sent/accepted/declined/expired, **client accept/decline page**, convert to invoice |
| **Payments / Expenses** | Payment register by mode; expenses with categories, tax, billable flag, linked customer/project |
| **Projects** | Members, fixed/hourly billing, deadline, auto progress from tasks, time logged, linked invoices/expenses, notes |
| **Tasks** | List + Kanban, priorities, multiple assignees, comments, **start/stop timer & timesheet** |
| **Support** | Tickets with departments, priority, assignment, threaded staff replies, status workflow |
| **Reports** | Income vs expenses by month/year, net profit, tax invoiced, top customers, expenses by category, lead conversion by source |
| **Admin** | Staff management, roles & permission matrix, company settings, invoice/estimate defaults, bank details, tax rates, saved items, payment modes, lead statuses (kanban columns)/sources, expense categories, departments |
| **Extras** | Global search, "+ New" quick menu, mobile-friendly sidebar, Squareit branding |

## Going live (free options)

SQLite is fine for local use. For a hosted site, switch to MySQL or Postgres:

1. In `prisma/schema.prisma` change `provider = "sqlite"` to `"mysql"` (or `"postgresql"`).
2. Set `DATABASE_URL` in `.env`, for example `mysql://user:pass@host:3306/squareit_crm`.
3. Set a long random `AUTH_SECRET`.
4. Run `npm run setup`, then `npm run build` and `npm start`.

Free hosting combos: **Vercel + Neon (Postgres)**, **Vercel + TiDB Serverless (MySQL)**, or any VPS/cPanel host with Node.js support plus the MySQL database you already have.
Don't use SQLite on Vercel, because its filesystem is not persistent.

## Project structure

```
prisma/schema.prisma     database models
prisma/seed.ts           default lookups + admin (+ demo data)
src/lib/                 db, auth/session, permissions, settings, sales maths, formatting
src/components/          UI kit, kanban, line-item editor, invoice document, charts
src/app/login            login page
src/app/admin/*          one folder per module (page.tsx, actions.ts, form.tsx, [id]/…)
src/app/invoice|estimate public client pages
```

## Suggested Phase 2

Client portal (customer login), proposals, contracts with e-signature, credit notes, recurring invoices and subscriptions,
email sending (Nodemailer via SMTP, free), PDF download, file attachments, knowledge base, surveys, goals,
custom fields, CSV import/export, and a data import from the old Perfex database if you ever need it.
