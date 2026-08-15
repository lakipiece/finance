export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-field bg-surface-low animate-pulse" />
        ))}
      </div>
      <div className="h-[280px] rounded-card bg-surface-low animate-pulse" />
      <div className="h-[200px] rounded-card bg-surface-low animate-pulse" />
    </div>
  )
}
