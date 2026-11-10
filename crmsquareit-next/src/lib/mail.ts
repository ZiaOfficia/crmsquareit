import "server-only";
import nodemailer from "nodemailer";

/** SMTP is configured through env vars (see .env.example). */
export const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

/** Sends an email. Returns false when SMTP isn't configured or sending fails. */
export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  if (!mailConfigured()) return false;
  const port = Number(process.env.SMTP_PORT || 465);
  try {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
    return true;
  } catch (e) {
    console.error("[mail] send failed:", e);
    return false;
  }
}
