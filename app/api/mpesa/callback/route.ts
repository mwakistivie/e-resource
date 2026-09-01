import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractCallbackReceipt, StkCallbackPayload } from "@/lib/mpesa";
import { sendReceiptEmail } from "@/lib/email";

/**
 * Safaricom hits this endpoint asynchronously after the customer enters
 * (or cancels/fails to enter) their M-Pesa PIN. It can arrive more than
 * once for the same transaction and can arrive late — every code path
 * below is written to be safe to run twice.
 *
 * Always return 200 quickly: Safaricom retries aggressively on non-200s,
 * which would otherwise cause duplicate processing storms.
 */
export async function POST(req: NextRequest) {
  const payload = (await req.json()) as StkCallbackPayload;
  const cb = payload.Body?.stkCallback;

  if (!cb?.CheckoutRequestID) {
    // Malformed payload — log nothing to attach it to (no order match possible), just ack.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const order = await prisma.order.findUnique({
    where: { mpesaCheckoutRequestId: cb.CheckoutRequestID },
  });

  if (!order) {
    // Don't trust a callback we can't correlate to a known order.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  // Log every callback, including duplicates — this is the audit trail
  // and what makes debugging "customer paid but says they didn't get it" possible.
  await prisma.paymentEvent.create({
    data: { orderId: order.id, rawPayload: payload as any, resultCode: cb.ResultCode },
  });

  // Idempotency: if we've already marked this order PAID, ack and stop.
  // Prevents double-fulfillment (duplicate emails, duplicate download tokens).
  if (order.status === "PAID") {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  if (cb.ResultCode === 0) {
    const receipt = extractCallbackReceipt(payload);

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        mpesaReceiptNumber: receipt.mpesaReceiptNumber,
      },
    });

    const token = await prisma.downloadToken.create({
      data: {
        orderId: updated.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Fire-and-forget from the webhook's perspective: sendReceiptEmail
    // swallows its own errors and logs to EmailLog instead of throwing,
    // so a Resend outage never turns a successful payment into a 500 here.
    await sendReceiptEmail(updated.id);
    void token; // token itself isn't needed further in this handler
  } else {
    // ResultCode != 0 covers: customer cancelled, wrong PIN too many times,
    // insufficient funds, timeout. ResultDesc has the human-readable reason.
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "FAILED", mpesaResultDesc: cb.ResultDesc },
    });
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
