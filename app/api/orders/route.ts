import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/validators";
import { initiateStkPush, normalizeKenyanPhone } from "@/lib/mpesa";
import { sendReceiptEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/ratelimit";

// Beta free-access mode: when M-Pesa production/sandbox credentials aren't
// ready yet but you want real users testing the site, this skips the STK
// push entirely and marks the order paid immediately. Every "payment" is
// logged with mpesaResultDesc: "BETA_FREE_MODE" so it's unmistakable in
// the admin dashboard which orders were real revenue vs. free beta access.
// Flip BETA_FREE_MODE=false in .env the moment Daraja credentials land —
// nothing else in the codebase needs to change.
const BETA_FREE_MODE = process.env.BETA_FREE_MODE === "true";

export async function POST(req: NextRequest) {
  // 5 requests/minute/IP — this endpoint triggers a real STK push (or, in
  // beta mode, a real email send), so it's the highest-value target for
  // abuse: someone could otherwise spam a stranger's phone with M-Pesa
  // prompts, or spam an inbox with receipt emails, just by knowing their
  // number/email.
  const { success, retryAfterSeconds } = await rateLimit(`orders:${getClientIp(req)}`, 5, 60);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { resourceId, name, email, phone } = parsed.data;

  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource || resource.status !== "PUBLISHED") {
    return NextResponse.json({ error: "This resource is not available." }, { status: 404 });
  }

  // No accounts: a returning customer just creates a new Customer row.
  // Fine at this scale — orders are looked up by email+phone, not by a stable customer id.
  const customer = await prisma.customer.create({
    data: { name, email, phone: normalizeKenyanPhone(phone) },
  });

  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      resourceId: resource.id,
      amountKsh: resource.priceKsh,
      status: "PENDING",
      // Additive cart-prep write: today's checkout is still strictly
      // single-resource (see schema.prisma's OrderItem comment for why),
      // but every order gets exactly one matching OrderItem from here on,
      // snapshotting the price at purchase time.
      items: { create: { resourceId: resource.id, price: resource.priceKsh } },
    },
  });

  if (BETA_FREE_MODE) {
    const paid = await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date(), mpesaResultDesc: "BETA_FREE_MODE" },
    });
    await prisma.downloadToken.create({
      data: { orderId: paid.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    await sendReceiptEmail(paid.id);
    return NextResponse.json({ orderId: order.id, status: "PAID" });
  }

  try {
    const stk = await initiateStkPush({
      phone,
      amountKsh: resource.priceKsh,
      accountRef: order.id,
      description: resource.title,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        mpesaCheckoutRequestId: stk.checkoutRequestId,
        mpesaMerchantRequestId: stk.merchantRequestId,
      },
    });
  } catch (err) {
    // STK push itself failed to send (bad number, Daraja down, etc) — distinct
    // from "customer entered PIN wrong", which arrives later via the callback.
    await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
    return NextResponse.json(
      { error: "We couldn't send the M-Pesa prompt. Check the number and try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ orderId: order.id, status: "PENDING" });
}
