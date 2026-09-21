/** Shared "this screen's data failed to load" state — distinct from the loading and empty states. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "flex-start" }}>
      <div style={{ color: "var(--color-neg)" }}>Couldn&apos;t load this page: {message}</div>
      <button type="button" className="btn btn-secondary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
