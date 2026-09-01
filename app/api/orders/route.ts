import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/validators";
import { initiateStkPush, normalizeKenyanPhone } from "@/lib/mpesa";

export async function POST(req: NextRequest) {
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
    },
  });

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

  return NextResponse.json({ orderId: order.id });
}
