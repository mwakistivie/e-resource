/**
 * Safaricom Daraja API integration (Lipa Na M-Pesa Online / STK Push).
 *
 * Sandbox docs: https://developer.safaricom.co.ke/
 * Set MPESA_ENV=sandbox while developing — it uses its own test
 * shortcode/passkey and lets you simulate callbacks without moving
 * real money. Switch to MPESA_ENV=production only after go-live testing.
 *
 * NOTE: this file was written and reviewed for correctness against the
 * Daraja API shape, but has NOT been executed against Safaricom's servers
 * in this environment (no network access to safaricom.co.ke here). Test
 * against the sandbox before trusting it in production — see README.
 */

const BASE_URL = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
} as const;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function baseUrl() {
  const mode = (process.env.MPESA_ENV ?? "sandbox") as keyof typeof BASE_URL;
  return BASE_URL[mode];
}

/**
 * Appends MPESA_CALLBACK_SECRET as a query param when configured, so the
 * webhook handler (app/api/mpesa/callback/route.ts) can verify the request
 * actually came from a call we initiated, rather than blind-trusting any
 * POST that references a known CheckoutRequestID.
 */
function callbackUrl(): string {
  const base = env("MPESA_CALLBACK_URL");
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (!secret) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}secret=${encodeURIComponent(secret)}`;
}

/** OAuth token — cached in-memory for its ~1hr lifetime to avoid hammering the auth endpoint. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const key = env("MPESA_CONSUMER_KEY");
  const secret = env("MPESA_CONSUMER_SECRET");
  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error(`M-Pesa auth failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as { access_token: string; expires_in: string };
  cachedToken = {
    value: data.access_token,
    // refresh a minute early to be safe
    expiresAt: Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000,
  };
  return cachedToken.value;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/** Normalizes 07XXXXXXXX / +2547XXXXXXXX / 2547XXXXXXXX to Daraja's expected 2547XXXXXXXX. */
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  throw new Error(`Unrecognized phone format: ${raw}`);
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
}

/**
 * Initiates an STK Push prompt on the customer's phone.
 * `accountRef` should be the order id — short, no spaces, <= 12 chars ideally.
 */
export async function initiateStkPush(params: {
  phone: string;
  amountKsh: number;
  accountRef: string;
  description: string;
}): Promise<StkPushResult> {
  const token = await getAccessToken();
  const shortcode = env("MPESA_SHORTCODE");
  const passkey = env("MPESA_PASSKEY");
  const ts = timestamp();
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(params.amountKsh),
    PartyA: normalizeKenyanPhone(params.phone),
    PartyB: shortcode,
    PhoneNumber: normalizeKenyanPhone(params.phone),
    CallBackURL: callbackUrl(), // must be a public HTTPS URL — see README on ngrok for local dev
    AccountReference: params.accountRef.slice(0, 12),
    TransactionDesc: params.description.slice(0, 13),
  };

  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(`STK push rejected: ${JSON.stringify(data)}`);
  }

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription,
  };
}

/** Shape of the payload Safaricom POSTs to MPESA_CALLBACK_URL. */
export interface StkCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value?: string | number }>;
      };
    };
  };
}

export function extractCallbackReceipt(payload: StkCallbackPayload) {
  const items = payload.Body.stkCallback.CallbackMetadata?.Item ?? [];
  const find = (name: string) => items.find((i) => i.Name === name)?.Value;
  return {
    mpesaReceiptNumber: find("MpesaReceiptNumber") as string | undefined,
    amount: find("Amount") as number | undefined,
    phoneNumber: find("PhoneNumber") as number | undefined,
    transactionDate: find("TransactionDate") as number | undefined,
  };
}
