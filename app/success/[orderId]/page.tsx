import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function SuccessPage({ params }: { params: { orderId: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { resource: true, downloadToken: true, customer: true },
  });
  if (!order || order.status !== "PAID" || !order.downloadToken) notFound();

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-moss/10 text-moss flex items-center justify-center mx-auto mb-4 text-2xl">
        ✓
      </div>
      <h1 className="font-display text-2xl font-semibold text-ink">Payment received</h1>
      <p className="text-ink/60 mt-2">
        Receipt {order.mpesaReceiptNumber} · KSh {order.amountKsh}
      </p>
      <a
        href={`/api/download/${order.downloadToken.token}`}
        className="inline-block mt-6 rounded-md bg-moss text-white font-medium px-8 py-3"
      >
        Download {order.resource.title}
      </a>
      <p className="text-xs text-ink/50 mt-4">
        We've also emailed this link to {order.customer.email}. It stays valid for 7 days.
      </p>
    </div>
  );
}
