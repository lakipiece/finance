export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="h-12 rounded-card bg-surface-low animate-pulse" />
      <div className="h-24 rounded-card bg-surface-low animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="h-[300px] rounded-card bg-surface-low animate-pulse" />
        <div className="h-[300px] rounded-card bg-surface-low animate-pulse" />
      </div>
    </div>
  )
}
