# Invoices, tax invoices, estimates, payments and expenses

## Create an invoice
1. Go to [Invoices](/admin/invoices) → "Create invoice" (or + → Invoice, or from a customer or project).
2. Pick the Customer (required), optionally a Project, currency, date and due date.
3. Add line items (at least one), with quantity, rate and tax. Saved items from Settings can be inserted.
4. Add a Client note and Terms & conditions if needed, then save.
Errors: "Please select a customer", "Add at least one line item".

## Invoice statuses
Draft, Unpaid, Partially paid, Paid, Overdue (unpaid after the due date, in India time) and Cancelled. Status updates automatically as payments are recorded.

## Record a payment on an invoice
1. Open the invoice and click "Record payment".
2. Enter the Amount (greater than zero), Date, Payment mode and Transaction ID / Note.
3. Save. The invoice becomes Partially paid or Paid.
All payments are recorded from an invoice (or from a customer's Payments tab); the [Payments](/admin/payments) page lists them with This month and This year totals.

## Share an invoice with the client
Use "Client view" on the invoice to open the public link you can send to the client. "Duplicate" copies an invoice. Use "More actions" to change status or delete.

## Tax invoices (GST)
[Tax invoices](/admin/tax-invoices) make GST-compliant PDFs.
1. Click new tax invoice, pick the Customer (fills name, address, GSTIN and state), or type who it's billed to.
2. Pick the Place of supply: same state as Squareit (Uttar Pradesh) → 18% split as 9% CGST + 9% SGST; other state (for example Delhi) → 18% IGST.
3. Add items (quantity above 0, prices not negative), optional ship-to address, issued and due dates.
4. The invoice number is the next one in the financial year (for example SS/26-27/070) unless you type one.
GSTIN must be 15 characters (for example 09ABCDE1234F1Z5). Seller details and prefix are set in Settings → Tax invoices (GST PDF).

## Estimates
[Estimates](/admin/estimates) are quotes sent before work starts. Create one like an invoice (customer + line items). Statuses: Draft, Sent, Accepted, Declined, Expired. "Convert to invoice" turns an estimate into an invoice (once converted, it opens that invoice). (BDE proposals normally use Quotations instead.)

## Expenses (project / client costs)
1. Go to [Expenses](/admin/expenses) → "Record expense" (or + → Expense).
2. Enter Expense name, Category and a positive Amount (required), plus date, tax, payment mode, reference #, note.
3. Optionally link a Customer / Project and tick "Billable to customer".
Categories and payment modes are managed in Settings. For day-to-day office running costs use Office expenses instead.

## Reports
[Reports](/admin/reports) (needs Reports access) shows, per year: Income received, Expenses, Net profit, Tax invoiced, Income vs expenses by month, Expenses by category, Top customers by payments, and Lead conversion by source. Pick the year at the top.
