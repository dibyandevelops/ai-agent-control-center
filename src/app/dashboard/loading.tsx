export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen bg-sentinel-canvas font-sentinel text-sentinel-text">
      {/* Sidebar Skeleton */}
      <aside className="hidden w-64 shrink-0 border-r border-sentinel-line bg-sentinel-surface p-4 lg:flex lg:flex-col lg:justify-between animate-pulse">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-xl bg-sentinel-line" />
            <div className="h-5 w-28 rounded-md bg-sentinel-line" />
          </div>

          <div className="space-y-1.5 pt-4">
            <div className="h-9 w-full rounded-xl bg-sentinel-line/80" />
            <div className="h-9 w-full rounded-xl bg-sentinel-line/40" />
            <div className="h-9 w-full rounded-xl bg-sentinel-line/40" />
            <div className="h-9 w-full rounded-xl bg-sentinel-line/40" />
            <div className="h-9 w-full rounded-xl bg-sentinel-line/40" />
            <div className="h-9 w-full rounded-xl bg-sentinel-line/40" />
          </div>
        </div>

        <div className="border-t border-sentinel-line/70 pt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 rounded-full bg-sentinel-line" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-24 rounded bg-sentinel-line" />
              <div className="h-2.5 w-32 rounded bg-sentinel-line/60" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar Skeleton */}
        <header className="flex h-16 items-center justify-between border-b border-sentinel-line bg-sentinel-surface px-6 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-5 w-32 rounded bg-sentinel-line" />
            <div className="h-5 w-20 rounded-full bg-sentinel-line/60" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-44 rounded-xl bg-sentinel-line/50 hidden sm:block" />
            <div className="h-9 w-9 rounded-full bg-sentinel-line" />
            <div className="h-9 w-9 rounded-full bg-sentinel-line" />
          </div>
        </header>

        {/* Dashboard Body Skeleton */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 animate-pulse">
          {/* Header Area */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-8 w-60 rounded-xl bg-sentinel-line" />
              <div className="h-4 w-96 rounded-lg bg-sentinel-line/60" />
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-36 rounded-xl bg-sentinel-line" />
              <div className="h-10 w-36 rounded-xl bg-emerald-500/20 dark:bg-sentinel-lime/20" />
            </div>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 rounded bg-sentinel-line/70" />
                  <div className="h-8 w-8 rounded-lg bg-sentinel-line/50" />
                </div>
                <div className="h-8 w-20 rounded bg-sentinel-line font-mono" />
                <div className="h-3 w-32 rounded bg-sentinel-line/50" />
              </div>
            ))}
          </div>

          {/* Main Action & Data Panel */}
          <div className="rounded-3xl border border-sentinel-line bg-sentinel-surface p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-sentinel-line/60 pb-4">
              <div className="h-6 w-48 rounded bg-sentinel-line" />
              <div className="h-8 w-32 rounded-xl bg-sentinel-line/50" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-sentinel-line/60 bg-sentinel-canvas/40 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-sentinel-line" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-36 rounded bg-sentinel-line" />
                      <div className="h-3 w-48 rounded bg-sentinel-line/60" />
                    </div>
                  </div>
                  <div className="h-6 w-20 rounded-full bg-sentinel-line/70" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
