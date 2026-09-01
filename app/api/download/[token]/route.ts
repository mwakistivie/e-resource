import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/r2";

async function loadValidToken(token: string) {
  const dt = await prisma.downloadToken.findUnique({
    where: { token },
    include: { order: { include: { resource: { include: { bundleOf: { include: { childResource: true } } } } } } },
  });
  if (!dt) return { error: "This download link is invalid.", status: 404 } as const;
  if (dt.order.status !== "PAID") return { error: "This order hasn't been paid yet.", status: 403 } as const;
  if (dt.expiresAt < new Date()) return { error: "This download link has expired. Use the lookup page to request a new one.", status: 410 } as const;
  if (dt.downloadCount >= dt.maxDownloads) return { error: "This link has reached its download limit. Use the lookup page to request a new one.", status: 429 } as const;
  return { dt } as const;
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const result = await loadValidToken(params.token);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { dt } = result;
  const resource = dt.order.resource;

  if (!resource.isBundle && resource.fileKey) {
    await prisma.downloadToken.update({ where: { id: dt.id }, data: { downloadCount: { increment: 1 } } });
    const url = await getSignedDownloadUrl(resource.fileKey);
    return NextResponse.redirect(url, { status: 302 });
  }

  // Bundle: render a minimal file list rather than redirecting, since
  // there's more than one underlying file to hand over.
  const files = resource.bundleOf.map((b) => b.childResource);
  const html = `
    <!doctype html><html><head><meta charset="utf-8" />
    <title>Your download — ${resource.title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>body{font-family:sans-serif;max-width:480px;margin:60px auto;padding:0 16px;color:#1C2321}
    a.file{display:block;padding:14px 16px;border:1px solid #E7DFC9;border-radius:8px;margin-bottom:10px;text-decoration:none;color:#1C2321}
    a.file:hover{background:#FAF7F0}</style></head>
    <body>
      <h2>${resource.title}</h2>
      <p>This bundle contains ${files.length} file${files.length === 1 ? "" : "s"}. Click each to download.</p>
      ${files.map((f) => `<a class="file" href="/api/download/${params.token}/file/${f.id}">${f.title}</a>`).join("\n")}
    </body></html>
  `;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
