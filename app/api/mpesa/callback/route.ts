import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractCallbackReceipt, StkCallbackPayload } from "@/lib/mpesa";
import { sendReceiptEmail } from "@/lib/email";

/**
 * Safaricom hits this endpoint asynchronously after the customer enters
 * (or cancels/fails to enter) their M-Pesa PIN. It can arrive more than
 * once for the same transaction and can arrive late — every code path
 * below is written to be safe to run twice, including two callbacks
 * arriving concurrently (see the atomic claim below).
 *
 * Always return 200 quickly: Safaricom retries aggressively on non-200s,
 * which would otherwise cause duplicate processing storms.
 */
export async function POST(req: NextRequest) {
  // Daraja doesn't sign callbacks by default, so this shared-secret query
  // param is defense in depth: without it, anyone who guesses this URL
  // could POST a fake "payment succeeded" callback for a CheckoutRequestID
  // they don't control (though they'd still need a valid, unpaid order's
  // CheckoutRequestID to do anything — those aren't guessable UUIDs).
  // Set MPESA_CALLBACK_SECRET and lib/mpesa.ts appends it to the callback
  // URL automatically; nothing else needs to change.
  const configuredSecret = process.env.MPESA_CALLBACK_SECRET;
  if (configuredSecret) {
    const providedSecret = req.nextUrl.searchParams.get("secret");
    if (providedSecret !== configuredSecret) {
      // Still 200, not 401/403 — an attacker probing this endpoint learns
      // nothing from the response, and Safaricom itself would never send
      // the wrong secret once configured correctly.
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
  }

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

  if (order.status === "PAID") {
    // Already fulfilled by an earlier callback — ack and stop.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  if (cb.ResultCode === 0) {
    const receipt = extractCallbackReceipt(payload);

    // Atomic claim: this UPDATE only affects a row if it's still not PAID,
    // and returns how many rows it touched. If two callbacks for the same
    // order arrive concurrently, only one of them will see count === 1 —
    // the other sees 0 and backs off. A plain findUnique-then-update (the
    // previous version of this handler) has a race window between the read
    // and the write where both concurrent requests could pass the check
    // and both try to create a DownloadToken; this closes that window
    // without needing a database transaction/lock.
    const claim = await prisma.order.updateMany({
      where: { id: order.id, status: { not: "PAID" } },
      data: {
        status: "PAID",
        paidAt: new Date(),
        mpesaReceiptNumber: receipt.mpesaReceiptNumber,
      },
    });

    if (claim.count === 0) {
      // Lost the race to a concurrent callback for the same order — the
      // other request is handling fulfillment. Nothing more to do here.
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // DownloadToken.orderId is @unique in the schema, so even in the
    // unlikely event something else already created one, this throws
    // rather than silently duplicating — caught and treated as a no-op.
    try {
      await prisma.downloadToken.create({
        data: { orderId: order.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });
    } catch (err: any) {
      if (err?.code !== "P2002") throw err; // P2002 = unique constraint violation
    }

    // Fire-and-forget from the webhook's perspective: sendReceiptEmail
    // swallows its own errors and logs to EmailLog instead of throwing,
    // so a Resend outage never turns a successful payment into a 500 here.
    await sendReceiptEmail(order.id);
  } else {
    // ResultCode != 0 covers: customer cancelled, wrong PIN too many times,
    // insufficient funds, timeout. ResultDesc has the human-readable reason.
    // updateMany (not update) for the same reason as above — harmless if
    // it races with something else, since a FAILED write losing a race to
    // a PAID write is the correct outcome anyway.
    await prisma.order.updateMany({
      where: { id: order.id, status: { not: "PAID" } },
      data: { status: "FAILED", mpesaResultDesc: cb.ResultDesc },
    });
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
