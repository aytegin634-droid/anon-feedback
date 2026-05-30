export default function Loading() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 px-5 py-3 flex items-center justify-between">
        <div className="text-sm text-neutral-400">Загружаем тред…</div>
      </header>
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-4 p-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <div className="h-4 bg-neutral-100 rounded animate-pulse w-1/3" />
          <div className="h-3 bg-neutral-100 rounded animate-pulse w-1/2" />
          <div className="h-3 bg-neutral-100 rounded animate-pulse w-2/3" />
          <div className="h-3 bg-neutral-100 rounded animate-pulse w-1/2" />
          <div className="h-3 bg-neutral-100 rounded animate-pulse w-3/4" />
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="space-y-3">
            <div className="h-10 bg-neutral-100 rounded animate-pulse w-3/4" />
            <div className="h-10 bg-neutral-100 rounded animate-pulse w-2/3 ml-auto" />
            <div className="h-10 bg-neutral-100 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    </main>
  )
}