import OrderLookupForm from "@/components/OrderLookupForm";

export default function OrderLookupPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-display text-2xl font-semibold text-ink mb-1">Find your downloads</h1>
      <p className="text-sm text-ink/60 mb-6">
        Enter the email and phone number you used at checkout.
      </p>
      <OrderLookupForm />
    </div>
  );
}
