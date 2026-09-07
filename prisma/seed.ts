import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * No hardcoded default credentials — a well-known email/password pair
 * documented in a public README is a real risk if anyone forgets to
 * change it before going live. Seeding now requires you to explicitly
 * choose your own initial admin email/password via env vars, and fails
 * loudly if you don't.
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var: ${name}. Set ADMIN_INITIAL_EMAIL and ` +
        `ADMIN_INITIAL_PASSWORD before running the seed script — see .env.example.`
    );
  }
  return v;
}

async function main() {
  const email = requireEnv("ADMIN_INITIAL_EMAIL");
  const password = requireEnv("ADMIN_INITIAL_PASSWORD");
  if (password.length < 8) {
    throw new Error("ADMIN_INITIAL_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash },
  });
  console.log(`Seeded admin user: ${email}`);

  const notes = await prisma.resource.upsert({
    where: { slug: "grade-8-science-notes" },
    update: {},
    create: {
      title: "Grade 8 Science Notes",
      slug: "grade-8-science-notes",
      description: "Comprehensive notes covering the full Grade 8 Science syllabus, term 2.",
      resourceType: "STUDY_NOTES",
      subject: "Science",
      gradeLevel: "Grade 8",
      term: "Term 2",
      priceKsh: 100,
      status: "PUBLISHED",
      fileKey: null, // no real file until you upload one via the admin dashboard
    },
  });

  await prisma.resource.upsert({
    where: { slug: "grade-7-maths-scheme" },
    update: {},
    create: {
      title: "Grade 7 Mathematics Term 2 Scheme",
      slug: "grade-7-maths-scheme",
      description: "Complete scheme of work aligned to the CBC Grade 7 Mathematics syllabus.",
      resourceType: "SCHEME_OF_WORK",
      subject: "Mathematics",
      gradeLevel: "Grade 7",
      term: "Term 2",
      priceKsh: 150,
      status: "PUBLISHED",
      fileKey: null,
    },
  });

  console.log("Seeded sample resources.", notes.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
