import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ResourceType } from "@prisma/client";

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  SCHEME_OF_WORK: "Scheme of Work",
  LESSON_PLAN: "Lesson Plan",
  STUDY_NOTES: "Study Notes",
  REVISION_MATERIAL: "Revision Material",
  REVISION_QUESTIONS: "Revision Questions",
  EXAMINATION: "Examination",
  ASSESSMENT_PAPER: "Assessment Paper",
  MARKING_SCHEME: "Marking Scheme",
  WORKSHEET: "Worksheet",
  TEACHING_ACTIVITY: "Teaching Activity",
  PRESENTATION: "PowerPoint Presentation",
  EBOOK: "E-book",
  PAST_PAPER: "Past Paper",
  DIGITAL_QUIZ: "Digital Quiz",
  EDUCATIONAL_VIDEO: "Educational Video",
  OTHER: "Other",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; subject?: string; grade?: string };
}) {
  const { q, type, subject, grade } = searchParams;

  const resources = await prisma.resource.findMany({
    where: {
      status: "PUBLISHED",
      ...(type ? { resourceType: type as ResourceType } : {}),
      ...(subject ? { subject } : {}),
      ...(grade ? { gradeLevel: grade } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  // Filter dropdown options derived from published resources so the UI
  // never offers a filter combination that returns zero results.
  const [subjects, grades] = await Promise.all([
    prisma.resource.findMany({ where: { status: "PUBLISHED" }, select: { subject: true }, distinct: ["subject"] }),
    prisma.resource.findMany({ where: { status: "PUBLISHED" }, select: { gradeLevel: true }, distinct: ["gradeLevel"] }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <section className="mb-10">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ink max-w-2xl leading-tight">
          Ready-made teaching materials, delivered the moment you pay.
        </h1>
        <p className="mt-3 text-ink/70 max-w-xl">
          Schemes, notes, past papers and more — no account needed. Search, pay with M-Pesa, download.
        </p>
      </section>

      <form className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search resources…"
          className="col-span-2 sm:col-span-1 rounded-md border border-sand bg-white px-3 py-2 text-sm"
        />
        <select name="type" defaultValue={type ?? ""} className="rounded-md border border-sand bg-white px-3 py-2 text-sm">
          <option value="">All types</option>
          {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select name="subject" defaultValue={subject ?? ""} className="rounded-md border border-sand bg-white px-3 py-2 text-sm">
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.subject} value={s.subject}>{s.subject}</option>
          ))}
        </select>
        <select name="grade" defaultValue={grade ?? ""} className="rounded-md border border-sand bg-white px-3 py-2 text-sm">
          <option value="">All grades</option>
          {grades.map((g) => (
            <option key={g.gradeLevel} value={g.gradeLevel}>{g.gradeLevel}</option>
          ))}
        </select>
        <button type="submit" className="col-span-2 sm:col-span-4 sm:w-40 rounded-md bg-moss text-white text-sm font-medium py-2">
          Apply filters
        </button>
      </form>

      {resources.length === 0 ? (
        <p className="text-ink/60 py-16 text-center">
          No resources match those filters yet. Try clearing one of them.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {resources.map((r) => (
            <Link
              key={r.id}
              href={`/resources/${r.slug}`}
              className="border border-sand rounded-lg bg-white p-5 hover:shadow-md transition-shadow flex flex-col"
            >
              <span className="text-xs uppercase tracking-wide text-clay font-medium">
                {RESOURCE_TYPE_LABELS[r.resourceType]}{r.isBundle ? " · Bundle" : ""}
              </span>
              <h3 className="font-display text-lg font-semibold mt-1 text-ink">{r.title}</h3>
              <p className="text-sm text-ink/60 mt-1 line-clamp-2">{r.description}</p>
              <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="text-xs text-ink/50">{r.subject} · {r.gradeLevel}</span>
                <span className="font-semibold text-ink">KSh {r.priceKsh}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
