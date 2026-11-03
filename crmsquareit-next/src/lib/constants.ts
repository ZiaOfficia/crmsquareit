export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "purple";

export const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "gray" },
  UNPAID: { label: "Unpaid", tone: "red" },
  PARTIAL: { label: "Partially paid", tone: "amber" },
  PAID: { label: "Paid", tone: "green" },
  OVERDUE: { label: "Overdue", tone: "red" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
};

export const ESTIMATE_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "gray" },
  SENT: { label: "Sent", tone: "blue" },
  ACCEPTED: { label: "Accepted", tone: "green" },
  DECLINED: { label: "Declined", tone: "red" },
  EXPIRED: { label: "Expired", tone: "amber" },
};

export const PROJECT_STATUS: Record<string, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: "Not started", tone: "gray" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  ON_HOLD: { label: "On hold", tone: "amber" },
  CANCELLED: { label: "Cancelled", tone: "red" },
  FINISHED: { label: "Finished", tone: "green" },
};

export const TASK_STATUS: Record<string, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: "Not started", tone: "gray" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  TESTING: { label: "Testing", tone: "purple" },
  AWAITING_FEEDBACK: { label: "Awaiting feedback", tone: "amber" },
  COMPLETE: { label: "Complete", tone: "green" },
};

export const PRIORITY: Record<string, { label: string; tone: Tone }> = {
  LOW: { label: "Low", tone: "gray" },
  MEDIUM: { label: "Medium", tone: "blue" },
  HIGH: { label: "High", tone: "amber" },
  URGENT: { label: "Urgent", tone: "red" },
};

export const TICKET_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Open", tone: "red" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  ANSWERED: { label: "Answered", tone: "green" },
  ON_HOLD: { label: "On hold", tone: "amber" },
  CLOSED: { label: "Closed", tone: "gray" },
};

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD"];
export const PAGE_SIZE = 20;
