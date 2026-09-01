import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { sendReceiptEmail } from "@/lib/email";

// Covers the "M-Pesa payment succeeded but the email never arrived" gap
// flagged in the plan review — admin can manually re-trigger delivery.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.status !== "PAID") {
    return NextResponse.json({ error: "Order not found or not paid." }, { status: 400 });
  }
  await sendReceiptEmail(order.id);
  return NextResponse.json({ ok: true });
}
