import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cycles resource types through the three brand colors rather than
// assigning one color per type — keeps the palette from feeling like a
// confusing color-coding system while still giving cards visual variety.
const PALETTE = ["#2F5D50", "#C4622D", "#1C2321"]; // moss, clay, ink

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapTitle(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxCharsPerLine) {
      lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const resource = await prisma.resource.findUnique({ where: { id: params.id } });
  if (!resource) return new NextResponse("Not found", { status: 404 });

  const color = colorFor(resource.id);
  const titleLines = wrapTitle(resource.title, 22);
  const typeLabel = resource.resourceType.replaceAll("_", " ");

  const svg = `
<svg width="400" height="240" viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="240" fill="${color}" />
  <text x="24" y="34" font-family="Inter, sans-serif" font-size="11" fill="#FAF7F0" opacity="0.75" letter-spacing="1.5">${escapeXml(typeLabel.toUpperCase())}${resource.isBundle ? " · BUNDLE" : ""}</text>
  ${titleLines
    .map(
      (line, i) =>
        `<text x="24" y="${82 + i * 30}" font-family="serif" font-size="22" font-weight="600" fill="#FAF7F0">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  <text x="24" y="212" font-family="Inter, sans-serif" font-size="13" fill="#FAF7F0" opacity="0.85">${escapeXml(resource.subject)} · ${escapeXml(resource.gradeLevel)}</text>
  <text x="376" y="34" font-family="serif" font-size="17" font-weight="600" fill="#FAF7F0" text-anchor="end" opacity="0.9">Soma.</text>
</svg>`.trim();

  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
