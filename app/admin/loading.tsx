export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
      <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-[300px] rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-[300px] rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    </div>
  )
}
