/**
 * Loading state for site route transitions.
 */
export default function SiteLoading() {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/30">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/40 border-t-[var(--site-color-primary)]" />
    </div>
  );
}

