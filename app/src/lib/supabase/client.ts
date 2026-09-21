"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client, for the login page's "Sign in with Google"
 * button and the top-right "Sign out" button. Uses the same
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY already in
 * .env.local — no new environment variable.
 */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
