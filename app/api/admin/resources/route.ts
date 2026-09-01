import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { resourceInputSchema } from "@/lib/validators";

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 7)
  ); // random suffix avoids collisions without a DB round-trip
}

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const resources = await prisma.resource.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ resources });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = resourceInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  const { bundleChildIds, ...data } = parsed.data;

  const resource = await prisma.resource.create({
    data: {
      ...data,
      resourceType: data.resourceType as any,
      slug: slugify(data.title),
      status: "DRAFT",
      fileKey: body.fileKey ?? null,
    },
  });

  if (data.isBundle && bundleChildIds?.length) {
    await prisma.bundleItem.createMany({
      data: bundleChildIds.map((childResourceId) => ({ bundleResourceId: resource.id, childResourceId })),
    });
  }

  return NextResponse.json({ resource });
}
