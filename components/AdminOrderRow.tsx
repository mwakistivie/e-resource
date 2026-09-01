"use client";

import { useState } from "react";

export default function AdminOrderRow({
  id, resourceTitle, customerEmail, amountKsh, status, receiptNumber,
}: { id: string; resourceTitle: string; customerEmail: string; amountKsh: number; status: string; receiptNumber: string | null }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    setSending(true);
    const res = await fetch(`/api/admin/orders/${id}/resend`, { method: "POST" });
    setSending(false);
    setSent(res.ok);
  }

  return (
    <tr className="border-b border-sand/60">
      <td className="py-2 pr-4">{resourceTitle}</td>
      <td className="py-2 pr-4">{customerEmail}</td>
      <td className="py-2 pr-4">KSh {amountKsh}</td>
      <td className="py-2 pr-4">
        <span className={`text-xs px-2 py-0.5 rounded-full ${status === "PAID" ? "bg-moss/10 text-moss" : status === "FAILED" ? "bg-red-50 text-red-600" : "bg-sand text-ink/60"}`}>
          {status}
        </span>
      </td>
      <td className="py-2 pr-4 text-xs text-ink/50">{receiptNumber ?? "—"}</td>
      <td className="py-2 text-right">
        {status === "PAID" && (
          <button onClick={resend} disabled={sending} className="text-xs text-moss font-medium">
            {sent ? "Sent" : sending ? "Sending…" : "Resend email"}
          </button>
        )}
      </td>
    </tr>
  );
}
