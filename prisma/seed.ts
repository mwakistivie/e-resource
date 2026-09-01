import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("changeme123", 12);
  await prisma.adminUser.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { email: "admin@example.com", passwordHash },
  });
  console.log("Seeded admin: admin@example.com / changeme123 — change this immediately.");

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
