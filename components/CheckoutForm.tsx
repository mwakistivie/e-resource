"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckoutForm({ resourceId, priceKsh }: { resourceId: string; priceKsh: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId, name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
      router.push(`/checkout/${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-sand rounded-lg bg-white p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Full name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-sand px-3 py-2 text-sm"
          placeholder="Jane Wanjiru"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Email — your receipt and download link go here</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-sand px-3 py-2 text-sm"
          placeholder="jane@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">M-Pesa phone number</label>
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-sand px-3 py-2 text-sm"
          placeholder="07XXXXXXXX"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-clay text-white font-medium py-3 disabled:opacity-60"
      >
        {loading ? "Sending M-Pesa prompt…" : `Pay KSh ${priceKsh} with M-Pesa`}
      </button>
      <p className="text-xs text-ink/50 text-center">
        You'll get a prompt on your phone to enter your M-Pesa PIN.
      </p>
    </form>
  );
}
