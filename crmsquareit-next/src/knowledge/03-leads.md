# Leads

## What a lead is
A lead is a prospect who might become a customer. Leads live in [Leads](/admin/leads). You need Leads access (BDE staff have it automatically).

## Add a new lead
1. Go to [Leads](/admin/leads) and click "Add lead" (or use + → Lead in the top bar, or open [/admin/leads/new](/admin/leads/new)).
2. Fill in Name (required) and whatever you know: Company, Position, Email, Phone, Website, Address, City, Country, Lead value, Source, Status, Assigned to, Description.
3. Save. The lead opens on its own page.
If you get "Lead name is required", fill in the Name field.

## The lead journey (BDE flow)
Every lead moves through stages, worked out automatically from what you do:
New lead → Quotation sent → Follow-up → Hot / Cold / Junk → Customer.
- New lead: nothing done yet. Next step: send a quotation.
- Quotation sent: a quotation for this lead was marked Sent (or Accepted/Declined). Next: follow up on it.
- Follow-up: at least one follow-up has been logged. Next: decide hot, cold or junk.
- Hot lead: likely to buy. Next: close the deal and convert.
- Cold lead: not now; keep nurturing.
- Junk lead: not a real prospect; no action.
- Customer: converted; the deal is won.
The stage is never typed in by hand; it follows the lead's data, so it can't drift.

## Log a follow-up (call, WhatsApp, email, meeting)
1. Open the lead.
2. In "Log follow-up" choose how you followed up (Call, WhatsApp, Email or Meeting).
3. Write what the client said, and pick an Outcome: "Still deciding — keep following up", "Hot", "Cold — not now, nurture later" or "Junk — not a real prospect".
4. Set the Next follow-up date (when to contact them again) and save.
Errors: "Pick how you followed up" means choose a channel; "Write what happened or pick an outcome" means add a note or an outcome. A new lead page reminds you: "Start by sending this lead a quotation" (or, if a draft exists, to mark it as sent once the client has it).
"Log contact now" just records that you contacted the lead today (updates Last contact).

## Sort a lead as hot, cold or junk
On the lead page, use "Sort this lead" / the Lead journey buttons to mark it Hot, Cold or Junk, or move it back to undecided. A lead can also be marked Lost.

## Follow-ups due today
Leads whose Next follow-up date is today or earlier are "due". They appear on the BDE dashboard under "Follow up today" and in the Leads list labelled "Today" (amber) or "Overdue" (red). Leads with no follow-up date and no contact for 7 days also appear so they aren't forgotten.

## Convert a lead to a customer
1. Open the lead and click "Convert to customer".
2. The CRM creates a customer from the lead (company, phone, website, address, and the email as the primary contact), moves the lead's quotations and notes to the customer, and marks the won quotation as Accepted (the accepted one, or else the latest sent one, or else the latest draft).
3. You land on the customer's Payments tab to record the advance.
You need permission to create customers. A converted lead shows "View customer".

## Leads list, filters and kanban board
- The list can be searched ("Search leads…") and filtered by status, source and assigned person.
- Switch to Kanban to see leads as cards in columns by status; drag a card to change its status. The columns are the Lead statuses set in Settings.
- Lead statuses and Lead sources are managed by a Super Admin in [Settings](/admin/settings).

## Edit or delete a lead
Open the lead and use Edit to change details. Delete needs Leads delete permission.

## Notes and activity
Each lead page has notes you can add, and an Activity log showing everything done to it (created, quotation sent, follow-ups, conversion).
