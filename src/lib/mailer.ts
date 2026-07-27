// Thin nodemailer wrapper — mirrors the quinacare.org mailer so the
// Putumayo Carrera signup notifications go out through the same SMTP
// provider (Resend). Reads credentials from the environment (.env).

import nodemailer from "nodemailer";

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export async function sendMail(payload: MailPayload): Promise<void> {
  // Read at runtime from process.env (Netlify production env) first, with
  // import.meta.env as the `astro dev` fallback — same reasoning as the
  // Turso client, so credentials aren't inlined into the build.
  const host = process.env.SMTP_HOST ?? import.meta.env.SMTP_HOST;
  const port =
    Number(process.env.SMTP_PORT ?? import.meta.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER ?? import.meta.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? import.meta.env.SMTP_PASS;
  // Authenticated sender must be on a domain verified at the SMTP
  // provider; the runner's address goes in replyTo so SPF/DKIM pass.
  const from =
    process.env.MAIL_FROM ??
    import.meta.env.MAIL_FROM ??
    "Hospital San Miguel <noreply@quinacare.org>";

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured: set SMTP_HOST / SMTP_USER / SMTP_PASS in .env",
    );
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transport.sendMail({ from, ...payload });
}
