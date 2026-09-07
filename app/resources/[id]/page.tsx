import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CheckoutForm from "@/components/CheckoutForm";

export default async function ResourceDetailPage({ params }: { params: { id: string } }) {
  const resource = await prisma.resource.findFirst({
    where: { slug: params.id, status: "PUBLISHED" },
    include: { bundleOf: { include: { childResource: true } } },
  });

  if (!resource) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 grid md:grid-cols-5 gap-8">
      <div className="md:col-span-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- auto-generated SVG, not an optimizable static asset */}
        <img
          src={`/api/resources/${resource.id}/thumbnail`}
          alt=""
          className="w-full aspect-[5/3] object-cover rounded-lg mb-6"
        />
        <span className="text-xs uppercase tracking-wide text-clay font-medium">
          {resource.subject} · {resource.gradeLevel}{resource.term ? ` · ${resource.term}` : ""}
        </span>
        <h1 className="font-display text-3xl font-semibold text-ink mt-1">{resource.title}</h1>
        <p className="mt-4 text-ink/70 whitespace-pre-line">{resource.description}</p>

        {resource.previewFileKey && (
          <a
            href={`/api/resources/${resource.id}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-5 text-sm font-medium text-moss border border-moss rounded-md px-4 py-2 hover:bg-moss/5"
          >
            Preview the first page
          </a>
        )}

        {resource.isBundle && resource.bundleOf.length > 0 && (
          <div className="mt-6">
            <h2 className="font-medium text-ink mb-2">What's included</h2>
            <ul className="space-y-1">
              {resource.bundleOf.map((item) => (
                <li key={item.id} className="text-sm text-ink/70 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-moss" />
                  {item.childResource.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="md:col-span-2">
        <div className="sticky top-24">
          <p className="font-display text-3xl font-semibold text-ink mb-4">KSh {resource.priceKsh}</p>
          <CheckoutForm resourceId={resource.id} priceKsh={resource.priceKsh} betaFreeMode={process.env.BETA_FREE_MODE === "true"} />
          <p className="text-xs text-ink/40 text-center mt-4">
            Secure M-Pesa checkout · Instant download · Link stays valid for 7 days
          </p>
        </div>
      </div>
    </div>
  );
}
