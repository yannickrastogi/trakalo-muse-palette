// Loading placeholder shaped like the playlist cards on the Playlists page.
// Shown ONLY in place of the "no playlists" empty state while data is loading,
// so a reload never flashes "No playlists" before the real cards arrive.
// Standalone + dependency-free so other list pages can reuse it.

interface PlaylistGridSkeletonProps {
  /** Number of placeholder cards to render (default matches a full first row). */
  count?: number;
}

export function PlaylistGridSkeleton({ count = 8 }: PlaylistGridSkeletonProps) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-premium flex flex-col animate-pulse">
          {/* Cover — matches the real card's square cover area */}
          <div className="p-4 pb-0">
            <div className="w-full max-w-[200px] mx-auto aspect-square rounded-xl bg-muted" />
          </div>
          {/* Info — title + meta lines */}
          <div className="p-4 pt-4 flex-1 flex flex-col gap-2">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
