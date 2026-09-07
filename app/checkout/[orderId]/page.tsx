import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PaymentWaiting from "@/components/PaymentWaiting";

export default async function CheckoutPage({ params }: { params: { orderId: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { resource: true },
  });
  if (!order) notFound();

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="border border-sand rounded-lg bg-white p-6">
        <p className="text-sm text-ink/60">{order.resource.title}</p>
        <p className="font-display text-2xl font-semibold text-ink mt-1">KSh {order.amountKsh}</p>
        <PaymentWaiting orderId={order.id} />
      </div>
    </div>
  );
}
