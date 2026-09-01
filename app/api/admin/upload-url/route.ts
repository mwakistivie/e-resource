import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getSignedUploadUrl, buildFileKey } from "@/lib/storage";
import { z } from "zod";

const schema = z.object({ filename: z.string(), slug: z.string() });

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const fileKey = buildFileKey(parsed.data.slug, parsed.data.filename);
  const { path, token } = await getSignedUploadUrl(fileKey);
  // path === fileKey, returned separately since that's what the Supabase
  // client's uploadToSignedUrl() call expects as its first argument.
  return NextResponse.json({ path, token, fileKey, bucket: process.env.SUPABASE_STORAGE_BUCKET });
}
