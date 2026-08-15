export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-surface-card rounded-card h-32 animate-pulse" />
      ))}
    </div>
  )
}
