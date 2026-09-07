import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service_role key, which bypasses
 * Row Level Security. NEVER import this file from a client component or
 * expose SUPABASE_SERVICE_ROLE_KEY to the browser — that key grants full
 * read/write to every bucket regardless of RLS policy.
 */
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const supabaseAdmin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

const BUCKET = () => env("SUPABASE_STORAGE_BUCKET");

/**
 * Short-lived signed URL for a *download*, generated fresh every time a
 * customer clicks their (long-lived) email link. Never email this URL
 * directly — see DownloadToken in the Prisma schema for why.
 */
export async function getSignedDownloadUrl(fileKey: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET()).createSignedUrl(fileKey, expiresInSeconds);
  if (error || !data) throw new Error(`Failed to create signed download URL: ${error?.message}`);
  return data.signedUrl;
}

/**
 * Signed upload target for the admin's browser to PUT a file to directly
 * (via the Supabase JS client's uploadToSignedUrl), so uploads don't have
 * to round-trip through our own server. Unlike a raw S3 presigned URL,
 * Supabase returns a {path, token} pair — the actual upload call happens
 * client-side using @supabase/supabase-js with the public anon key plus
 * this token (see components/AdminResourceForm.tsx).
 */
export async function getSignedUploadUrl(fileKey: string): Promise<{ path: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET()).createSignedUploadUrl(fileKey);
  if (error || !data) throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  return { path: data.path, token: data.token };
}

export function buildFileKey(resourceSlug: string, originalFilename: string): string {
  const ext = originalFilename.split(".").pop();
  return `resources/${resourceSlug}-${Date.now()}.${ext}`;
}
