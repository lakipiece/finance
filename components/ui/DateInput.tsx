'use client'

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}

export default function DateInput({ value, onChange, className = '', placeholder = '날짜 선택' }: Props) {
  const display = value
    ? value.replace(/-/g, '. ')
    : placeholder

  return (
    <div className={`relative inline-flex items-center gap-1.5 pb-1 border-b border-slate-200 hover:border-[#1A237E] transition-colors cursor-pointer group ${className}`}>
      <svg
        className="w-3 h-3 text-slate-300 group-hover:text-[#1A237E] shrink-0 transition-colors"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
      <span className={`text-xs tabular-nums transition-colors ${value ? 'text-slate-600' : 'text-slate-300'}`}>
        {display}
      </span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </div>
  )
}
