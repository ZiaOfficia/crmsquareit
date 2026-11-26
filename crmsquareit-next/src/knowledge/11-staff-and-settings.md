# Staff management and settings

## Add a staff member (Super Admin or HR)
1. Go to [Staff & roles](/admin/staff) → "Add staff member".
2. Enter First name and Email (required), Last name, Phone, a login password (at least 6 characters) and the Role.
3. Pick the Department and Team role (TL or Executive). Putting someone in HR gives them HR access.
4. Save. They can now log in with that email and password.
"Another staff member already uses this email" means the email is taken.

## Reset someone's password
Open the staff member and set a new password under Login password. Setting a password also answers any open "Reset requested" (forgot password) request. A Super Admin can reveal a stored password; every view is logged.

## Deactivate, reactivate or delete staff
Deactivate stops someone logging in but keeps their history; Activate brings them back. "Delete permanently" (Danger zone) removes them from the database. You can't deactivate, demote or delete your own account, and the last active Super Admin can't be removed.

## Departments
On the Staff page, Departments shows the organisation structure. Super Admin and HR can add a person to a department as TL or Executive, or remove them. HR can't change their own department or remove a Super Admin.

## Roles & permissions (Super Admin)
Create a role with a name and tick view / create / edit / delete per module, then Save role. Assign the role to staff. Super Admins always have full access.

## Settings (Super Admin)
[Settings](/admin/settings) holds:
- General: default currency and company information (name, address, GST number…).
- Invoices and Estimates: number prefixes, due / expiry days, default terms and client note, bank details.
- Quotations (BDE): prefix, validity days, opening paragraph, steps, terms and closing line.
- Tax invoices (GST PDF): seller name, address, email, prefix.
- Lead statuses (the columns of the leads kanban board; statuses in use can't be deleted) and Lead sources.
- Payment modes, Expense categories, Tax rates, Support departments.
- Saved items / services: reusable lines for invoices, estimates and quotations.
