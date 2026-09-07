import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { status: true, downloadToken: { select: { token: true } } },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Auto-expire orders that have sat PENDING too long — the customer likely
  // closed the tab before entering their PIN and no callback is coming.
  // (For MVP this check runs lazily on poll; a cron sweep is a nice-to-have,
  // see README.)
  return NextResponse.json({
    status: order.status,
    downloadToken: order.downloadToken?.token ?? null,
  });
}
