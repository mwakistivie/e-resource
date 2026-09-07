import { Resend } from "resend";
import { prisma } from "./prisma";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing required env var: RESEND_API_KEY");
  return new Resend(key);
}

/**
 * Sends the post-payment receipt + download link, and logs the attempt.
 * Called from the M-Pesa callback handler AFTER the order is marked paid —
 * intentionally decoupled so a Resend outage never blocks payment confirmation.
 * In production, call this from a background job/queue rather than inline;
 * for MVP simplicity it's called directly but wrapped so failures don't throw.
 */
export async function sendReceiptEmail(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { customer: true, resource: true, downloadToken: true },
  });

  const downloadUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/download/${order.downloadToken?.token}`;

  try {
    await client().emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "receipts@example.com",
      to: order.customer.email,
      subject: `Your download: ${order.resource.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Thanks, ${order.customer.name}!</h2>
          <p>Your payment for <strong>${order.resource.title}</strong> was received.</p>
          <p><strong>Receipt:</strong> ${order.mpesaReceiptNumber}<br/>
             <strong>Amount:</strong> KSh ${order.amountKsh}</p>
          <p><a href="${downloadUrl}" style="display:inline-block;padding:12px 20px;background:#2F5D50;color:white;border-radius:6px;text-decoration:none;">Download your resource</a></p>
          <p style="color:#666;font-size:13px;">This link stays valid for a week and works up to 10 times. Lost it? Just reply to this email with your phone number and we'll resend it.</p>
        </div>
      `,
    });

    await prisma.emailLog.create({
      data: { orderId, type: "receipt", toEmail: order.customer.email, status: "sent" },
    });
  } catch (err) {
    await prisma.emailLog.create({
      data: {
        orderId,
        type: "receipt",
        toEmail: order.customer.email,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    // Deliberately swallowed: the payment already succeeded and the order
    // is PAID. Admin can see the failed EmailLog row and hit "resend".
  }
}
