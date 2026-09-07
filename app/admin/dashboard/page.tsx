import { prisma } from "@/lib/prisma";
import AdminResourceForm from "@/components/AdminResourceForm";
import AdminResourceRow from "@/components/AdminResourceRow";
import AdminOrderRow from "@/components/AdminOrderRow";

export default async function AdminDashboardPage() {
  const [resources, orders] = await Promise.all([
    prisma.resource.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { resource: true, customer: true },
    }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Admin</h1>
        <form action="/api/admin/logout" method="post">
          <button className="text-sm text-ink/50">Sign out</button>
        </form>
      </div>

      <section>
        <h2 className="font-medium text-ink mb-3">Resources</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <AdminResourceForm />
          </div>
          <div className="md:col-span-2 border border-sand rounded-lg bg-white p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/50 border-b border-sand">
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Price</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <AdminResourceRow key={r.id} id={r.id} title={r.title} priceKsh={r.priceKsh} status={r.status} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-medium text-ink mb-3">Recent orders</h2>
        <div className="border border-sand rounded-lg bg-white p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-sand">
                <th className="py-2 pr-4 font-medium">Resource</th>
                <th className="py-2 pr-4 font-medium">Customer</th>
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Receipt</th>
                <th className="py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <AdminOrderRow
                  key={o.id}
                  id={o.id}
                  resourceTitle={o.resource.title}
                  customerEmail={o.customer.email}
                  amountKsh={o.amountKsh}
                  status={o.status}
                  receiptNumber={o.mpesaReceiptNumber}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
