import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initiateStkPush } from "@/lib/mpesa";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { customer: true, resource: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "PAID") return NextResponse.json({ error: "This order is already paid." }, { status: 400 });

  try {
    const stk = await initiateStkPush({
      phone: order.customer.phone,
      amountKsh: order.amountKsh,
      accountRef: order.id,
      description: order.resource.title,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PENDING",
        mpesaCheckoutRequestId: stk.checkoutRequestId,
        mpesaMerchantRequestId: stk.merchantRequestId,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't resend the M-Pesa prompt. Try again shortly." }, { status: 502 });
  }
}
