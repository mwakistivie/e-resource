import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Orders that never get an M-Pesa callback (customer closed the tab before
 * entering their PIN, or Safaricom's callback genuinely never arrives) sit
 * as PENDING forever without this. Call this on a schedule — Vercel Cron
 * (vercel.json) is the simplest option on this stack:
 *
 *   { "crons": [{ "path": "/api/cron/expire-orders", "schedule": "*\/15 * * * *" }] }
 *
 * Vercel Cron sends requests with a bearer token matching CRON_SECRET
 * automatically when configured in vercel.json + env vars — this route
 * checks for that header itself too, so it's safe even if triggered by
 * something other than Vercel Cron (e.g. a GitHub Actions schedule hitting
 * this URL directly with the same secret as a bearer token).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
  const result = await prisma.order.updateMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    data: { status: "EXPIRED" },
  });

  return NextResponse.json({ expired: result.count });
}
