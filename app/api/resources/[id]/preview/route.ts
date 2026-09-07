import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/storage";

// Deliberately ungated — this is the free preview, meant to be viewable by
// anyone before they pay. Only ever serves the watermarked one-page excerpt
// (previewFileKey), never the full purchasable file (fileKey).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const resource = await prisma.resource.findUnique({ where: { id: params.id } });
  if (!resource?.previewFileKey) {
    return NextResponse.json({ error: "No preview available for this resource." }, { status: 404 });
  }
  const url = await getSignedDownloadUrl(resource.previewFileKey, 300);
  return NextResponse.redirect(url, { status: 302 });
}
