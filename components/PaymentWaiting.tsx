"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 90_000; // show "retry" option after ~90s of no callback

export default function PaymentWaiting({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"PENDING" | "PAID" | "FAILED" | "EXPIRED">("PENDING");
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/orders/${orderId}/status`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);

      if (data.status === "PAID") {
        clearInterval(interval);
        router.push(`/success/${orderId}`);
        return;
      }
      if (data.status === "FAILED") {
        clearInterval(interval);
        return;
      }
      if (Date.now() - startRef.current > TIMEOUT_MS) {
        setTimedOut(true);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [orderId, router]);

  async function handleRetry() {
    setRetrying(true);
    setTimedOut(false);
    startRef.current = Date.now();
    setStatus("PENDING");
    await fetch(`/api/orders/${orderId}/retry`, { method: "POST" });
    setRetrying(false);
  }

  if (status === "FAILED") {
    return (
      <div className="text-center py-16">
        <p className="text-ink font-medium mb-2">Payment wasn't completed.</p>
        <p className="text-ink/60 text-sm mb-6">This can happen if the prompt was cancelled or the PIN was entered incorrectly.</p>
        <button onClick={handleRetry} disabled={retrying} className="rounded-md bg-clay text-white px-6 py-3 font-medium">
          {retrying ? "Sending…" : "Send the M-Pesa prompt again"}
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-16">
      <div className="animate-pulse w-3 h-3 rounded-full bg-moss mx-auto mb-4" />
      <p className="text-ink font-medium">Check your phone for the M-Pesa prompt</p>
      <p className="text-ink/60 text-sm mt-1">Enter your PIN to complete the payment.</p>
      {timedOut && (
        <div className="mt-8">
          <p className="text-sm text-ink/60 mb-3">Didn't get a prompt?</p>
          <button onClick={handleRetry} disabled={retrying} className="rounded-md border border-clay text-clay px-6 py-2.5 font-medium">
            {retrying ? "Sending…" : "Resend the prompt"}
          </button>
        </div>
      )}
    </div>
  );
}
