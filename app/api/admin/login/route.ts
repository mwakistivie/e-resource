import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createAdminSession } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  // Deliberately vague error on both "no such user" and "wrong password" —
  // don't leak which admin emails exist.
  if (!admin || !(await verifyPassword(parsed.data.password, admin.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createAdminSession(admin.id);
  return NextResponse.json({ ok: true });
}
