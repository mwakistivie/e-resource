"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminResourceRow({ id, title, priceKsh, status }: { id: string; title: string; priceKsh: number; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(next: string) {
    setLoading(true);
    await fetch(`/api/admin/resources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <tr className="border-b border-sand/60">
      <td className="py-2 pr-4">{title}</td>
      <td className="py-2 pr-4">KSh {priceKsh}</td>
      <td className="py-2 pr-4">
        <span className={`text-xs px-2 py-0.5 rounded-full ${status === "PUBLISHED" ? "bg-moss/10 text-moss" : "bg-sand text-ink/60"}`}>
          {status}
        </span>
      </td>
      <td className="py-2 text-right">
        {status !== "PUBLISHED" ? (
          <button disabled={loading} onClick={() => setStatus("PUBLISHED")} className="text-xs text-moss font-medium">Publish</button>
        ) : (
          <button disabled={loading} onClick={() => setStatus("ARCHIVED")} className="text-xs text-ink/50 font-medium">Archive</button>
        )}
      </td>
    </tr>
  );
}
