"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginBody />
    </Suspense>
  );
}

function LoginBody() {
  const params = useSearchParams();
  const errorParam = params.get("error");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
      <div className="card" style={{ padding: "var(--space-8)", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", width: "min(360px, 90vw)" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 20 }}>FP&amp;A Model</div>
        <p className="text-muted" style={{ margin: 0, fontSize: 13, textAlign: "center" }}>
          Sign in with the Google account your administrator added.
        </p>
        {errorParam === "no_access" && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-neg)", textAlign: "center" }}>You do not have access.</p>
        )}
        {errorParam === "auth_failed" && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-neg)", textAlign: "center" }}>Sign-in failed. Please try again.</p>
        )}
        <button type="button" className="btn btn-primary btn-block" onClick={signIn} disabled={busy}>
          {busy ? "Redirecting…" : "Sign in with Google"}
        </button>
      </div>
    </div>
  );
}
