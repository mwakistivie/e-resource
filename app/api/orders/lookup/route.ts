import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeKenyanPhone } from "@/lib/mpesa";
import { z } from "zod";

const schema = z.object({ email: z.string().email(), phone: z.string().min(9) });

// This is the whole "no accounts" redownload story: prove you know the
// email AND phone used at checkout, get your links back. No password to lose.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and phone." }, { status: 400 });

  const phone = normalizeKenyanPhone(parsed.data.phone);

  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      customer: { email: parsed.data.email, phone },
    },
    include: { resource: true, downloadToken: true },
    orderBy: { paidAt: "desc" },
  });

  // Refresh expired tokens so a real customer always gets a working link,
  // rather than a dead one that requires an admin to intervene.
  const results = [];
  for (const order of orders) {
    let token = order.downloadToken;
    if (!token || token.expiresAt < new Date()) {
      token = await prisma.downloadToken.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        update: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), downloadCount: 0 },
      });
    }
    results.push({ resourceTitle: order.resource.title, downloadUrl: `/api/download/${token.token}` });
  }

  return NextResponse.json({ orders: results });
}
