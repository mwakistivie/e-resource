import { createClient } from "@supabase/supabase-js";

/**
 * Client-safe Supabase instance — uses the public anon key, which is
 * meant to be exposed to the browser (unlike the service_role key in
 * lib/storage.ts). On its own the anon key can't touch a private bucket;
 * it only works here because the upload call also carries a short-lived
 * signed token minted server-side in getSignedUploadUrl().
 */
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
