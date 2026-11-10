# Organisation structure (departments, TL / Executive)

Status: **structure only**. TL and Executive permissions are not defined yet, and
nothing in the app grants or limits access by department yet.

## Hierarchy

Super Admin (`Staff.isAdmin = true`) has full access and is never limited by departments.

| Code     | Department          | Parent           |
|----------|---------------------|------------------|
| HR       | HR                  |                  |
| BDE      | BDE                 |                  |
| WEB_DEV  | Website Development |                  |
| SEO      | SEO                 |                  |
| GBP      | GBP                 |                  |
| PAID_ADS | Paid Advertising    |                  |
| SMM      | SMM                 | Paid Advertising |
| SEM      | SEM                 | Paid Advertising |
| SMO      | SMO                 |                  |

Every department without sub-departments has TL(s) and Executive(s). People are
placed in SMM or SEM, not in "Paid Advertising" itself, because a shared level above them
is still undecided.

## Data model (prisma/schema.prisma)

- `OrgDepartment`: a tree built with `parentId`. `code` is the stable key used in code; names can be renamed.
- `DepartmentMember`: (staffId, departmentId, teamRole = TL | EXECUTIVE), unique per pair.
  The schema allows several rows per person. The UI currently assigns one.
- The older `Department` model is unrelated. It only routes support tickets.

## Where things live

- `src/lib/org.ts`: structure, team roles, and helpers (`isSuperAdmin`, `isMemberOf`, `isTeamLeadOf`, `canManageOrg`).
- `src/lib/org-server.ts`: server-only checks (which departments people can be assigned to).
- `src/lib/auth.ts`: `getCurrentUser()` now includes `memberships`.
- Staff page, Departments view (`/admin/staff?view=departments`): Super Admin screen for placing people in departments.
- Staff form: Department and Team role fields (Super Admin only, enforced in `saveStaff`).

## Open decisions (don't implement until agreed)

1. Exact TL permissions (assigning work, reviewing work, approving leave, managing members, and so on).
2. Exact Executive permissions.
3. More than one TL per department? (Currently allowed; not restricted.)
4. Can a user belong to more than one department? (The schema allows it; the UI assigns one.)
5. Executives: own work only, or the team's work too?
6. TLs: see and manage all work in their department?
7. ~~HR: special access?~~ Decided 6 Nov 2026, see "HR access" below.
8. Paid Advertising: a shared manager or workflow above SMM and SEM?

Access for each department will be specified later.

## Changes made (4 Nov 2026)

All changes are inside `crmsquareit-next`. The old PHP app was not touched.
No new folders were created, and no migration folder or extra Prisma config was added.

New files:
- `src/lib/org.ts`: department list, team roles, access helpers.
- `src/lib/org-server.ts`: server-only checks used when assigning people.
- `src/app/admin/staff/departments-view.tsx`: the Departments screen.
- `ORG_STRUCTURE.md`: this file.

Edited files:
- `prisma/schema.prisma`: added the `OrgDepartment` and `DepartmentMember` models, plus `orgMemberships` on `Staff`.
- `prisma/seed.ts`: creates the 9 departments if they're missing (safe to re-run).
- `src/lib/auth.ts`: current user now includes department memberships; "Administrator" is shown as "Super Admin".
- `src/app/admin/layout.tsx`: top bar shows e.g. "SEO · TL".
- `src/app/admin/staff/page.tsx`: Department column, Departments button, Departments view.
- `src/app/admin/staff/actions.ts`: Department/Team role saving (Super Admin only), add/remove member actions.
- `src/app/admin/staff/form.tsx`: Department and Team role fields.
- `src/app/admin/staff/[id]/page.tsx`: loads memberships for the form.
- `src/app/admin/staff/roles/page.tsx`: label text only.

## Applying the database change

This only adds two new tables (`OrgDepartment`, `DepartmentMember`). Existing tables and data are not changed.

```
npm run db:push
npm run db:seed
```

`npm run build` runs both automatically, so a Vercel deploy applies it.
`DATABASE_URL` in `.env` must point to PostgreSQL. The schema uses `postgresql`, while `.env` currently has a SQLite path.

## Using it

Log in as Super Admin, go to **Staff**, then click **Departments** (`/admin/staff?view=departments`).
You can also set Department and Team role when adding or editing a staff member.

## HR access (6 Nov 2026)

Anyone in the HR department (TL or Executive) is treated as HR (`isHR` in `src/lib/org.ts`, `CurrentUser.isHR`).
HR gets `HR_PERMISSIONS` (`src/lib/permissions.ts`) on top of their role:
staff (all), tasks (all), expenses (all), office expenses (all), invoices (view/create/edit), payments (view/create), customers (view/create), projects (view).

HR also can:
- send announcements and manage the ones they sent (Super Admin manages all);
- place people in departments, except Super Admins and themselves;
- use the control panel on /admin ("HR dashboard") with the department tabs and an Office expenses tab.

Super Admin only: Roles & permissions, Settings, the Super Admin flag, editing Super Admins.

## Office expenses

`OfficeExpense` and `OfficeExpenseReport` tables, page `/admin/office-expenses`.
HR records office running costs. At month end HR submits the month, which locks it.
The Super Admin approves it, or sends it back with a note (that unlocks it so HR can resubmit).
Super Admin sees a review banner on the control panel and a badge in the sidebar.

## BDE access and Quotations (6 Nov 2026)

Anyone in the BDE department gets `BDE_PERMISSIONS`: leads (view/create/edit), customers (view/create/edit), quotations (all).
Department extras live in `DEPARTMENT_PERMISSIONS` (`src/lib/permissions.ts`) and are merged into the role's permissions at sign-in.

- `/admin` for BDE: their own leads, follow-ups due (no contact in 7+ days), pipeline, quotation numbers. A BDE TL sees the whole team.
- `/admin/quotations`: `Quotation` table; line items reuse `LineItem.quotationId`. Made for a lead, a customer, or someone new.
  BDE Executives see their own quotations; BDE TLs and Super Admins see all.
- PDF: `GET /admin/quotations/[id]/pdf` (`?inline=1` to open in the browser), rendered with `@react-pdf/renderer` (`src/lib/quotation-pdf.tsx`).
  Amounts show as "Rs." because the built-in PDF fonts have no rupee glyph.
- Settings → Finance → "Quotations (BDE)": number prefix, validity days, default cover note and terms.
- Converting a lead to a customer also links that lead's quotations to the new customer.
- PDF layout follows `src/pdformats/Squareit Quotation Dr Farhan Ahmad.pdf`: page-1 header and boxes, service cards (tag, points, fee),
  optional Scope of Work pages (sections written with simple markup: `- bullet`, `-- sub-point`, `## heading`, `> note`),
  pricing summary, next steps, terms (fee lines added automatically), signature boxes, dark footer band.
  New fields: `Quotation.subtitle/scopeIntro/scope/steps/closing`, `LineItem.tag/note`. Icon for the PDF: `public/logo-mark.png`.
