"use client";

import { useState } from "react";
import type { CommentaryRequest } from "@/lib/ai/commentary";

export function GenerateCommentaryButton({ request }: { request: CommentaryRequest }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; text?: string }>({
    status: "idle",
  });

  async function handleClick() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await res.json();
      if (data.error) {
        setState({ status: "error", text: data.error });
      } else {
        setState({ status: "done", text: data.text });
      }
    } catch {
      setState({ status: "error", text: "Could not reach the commentary service." });
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={state.status === "loading"}
        className="rounded border border-black/20 bg-white px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50"
      >
        {state.status === "loading" ? "Generating…" : "Generate Commentary"}
      </button>
      {state.status === "done" ? (
        <p className="mt-2 rounded bg-blue-50 p-3 text-sm text-blue-900">{state.text}</p>
      ) : null}
      {state.status === "error" ? (
        <p className="mt-2 rounded bg-amber-50 p-3 text-sm text-amber-900">{state.text}</p>
      ) : null}
    </div>
  );
}
