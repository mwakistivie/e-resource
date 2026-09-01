import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: { token: string; childId: string } }) {
  const dt = await prisma.downloadToken.findUnique({
    where: { token: params.token },
    include: { order: { include: { resource: { include: { bundleOf: true } } } } },
  });

  if (!dt) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (dt.order.status !== "PAID") return NextResponse.json({ error: "Order not paid" }, { status: 403 });
  if (dt.expiresAt < new Date()) return NextResponse.json({ error: "Link expired" }, { status: 410 });

  const belongsToBundle = dt.order.resource.bundleOf.some((b) => b.childResourceId === params.childId);
  if (!belongsToBundle) return NextResponse.json({ error: "File not part of this order" }, { status: 403 });

  const child = await prisma.resource.findUnique({ where: { id: params.childId } });
  if (!child?.fileKey) return NextResponse.json({ error: "File unavailable" }, { status: 404 });

  await prisma.downloadToken.update({ where: { id: dt.id }, data: { downloadCount: { increment: 1 } } });
  const url = await getSignedDownloadUrl(child.fileKey);
  return NextResponse.redirect(url, { status: 302 });
}
