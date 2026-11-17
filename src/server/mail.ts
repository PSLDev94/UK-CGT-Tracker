import { Resend } from "resend";
import type { SendAuthMail } from "./auth";

export function resendAuthMailer(apiKey: string, from: string): SendAuthMail {
  if (!apiKey || !from.endsWith("@cgttracker.com"))
    throw new Error("Configure a verified CGT Tracker email sender");
  const resend = new Resend(apiKey);
  return async ({ to, kind, url }) => {
    const verification = kind === "verification";
    const { error } = await resend.emails.send({
      from: `CGT Tracker <${from}>`,
      to,
      subject: verification
        ? "Verify your CGT Tracker email"
        : "Reset your CGT Tracker password",
      text: verification
        ? `Verify your email address to start using CGT Tracker:\n\n${url}\n\nThis link expires in one hour. If you did not create an account, you can ignore this email.`
        : `Use this link to set a new CGT Tracker password:\n\n${url}\n\nThis link expires in 30 minutes. If you did not request a reset, you can ignore this email.`,
    });
    // Never expose provider errors, recipient addresses or verification URLs in logs.
    if (error) throw new Error("Transactional email could not be delivered");
  };
}

/** The address is fixed server-side; submitted emails only set Reply-To. */
export function resendSupportMailer(apiKey: string, from: string) {
  if (!apiKey || !from.endsWith("@cgttracker.com"))
    throw new Error("Configure a verified sender");
  const resend = new Resend(apiKey);
  return async (message: import("./contact-api").ContactMessage) => {
    const { error } = await resend.emails.send(
      {
        from: `CGT Tracker <${from}>`,
        to: "support@cgttracker.com",
        replyTo: message.email,
        subject: "CGT Tracker support request",
        text: `Name: ${message.name}\nReply email: ${message.email}\n\n${message.message}`,
      },
      { idempotencyKey: `contact-${message.requestId}` },
    );
    if (error) throw new Error("Support message was not accepted");
  };
}
