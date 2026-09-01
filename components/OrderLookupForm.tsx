"use client";

import { useState } from "react";

export default function OrderLookupForm() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<{ resourceTitle: string; downloadUrl: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    setResults(data.orders);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          required
          type="email"
          placeholder="Email used at checkout"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-sand px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="Phone used at checkout"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-sand px-3 py-2 text-sm"
        />
        <button disabled={loading} className="w-full rounded-md bg-moss text-white font-medium py-3 disabled:opacity-60">
          {loading ? "Looking up…" : "Find my downloads"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {results && (
        <div className="mt-6 space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-ink/60">No paid orders found for that email + phone combination.</p>
          ) : (
            results.map((r, i) => (
              <a key={i} href={r.downloadUrl} className="block border border-sand rounded-md px-4 py-3 text-sm hover:bg-paper">
                {r.resourceTitle}
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
