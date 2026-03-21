'use client'

const CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비']
const VALUES = [284, 461, 191, 76] // 비율용 샘플 값

const PRESETS = [
  {
    id: 'tableau',
    name: 'Tableau 10',
    desc: '데이터 시각화 업계 표준 팔렛트',
    colors: ['#4E79A7', '#E15759', '#59A14F', '#F28E2B'],
    header: 'linear-gradient(135deg, #2D3E50 0%, #4E79A7 100%)',
  },
  {
    id: 'd3-category',
    name: 'D3 Category10',
    desc: '웹 차트의 가장 보편적인 기본 팔렛트',
    colors: ['#1F77B4', '#D62728', '#2CA02C', '#FF7F0E'],
    header: 'linear-gradient(135deg, #0D3B6E 0%, #1F77B4 100%)',
  },
  {
    id: 'observable',
    name: 'Observable',
    desc: '모던 데이터 시각화 도구의 팔렛트',
    colors: ['#4269D0', '#FF725C', '#6CC5B0', '#EFB118'],
    header: 'linear-gradient(135deg, #1A237E 0%, #4269D0 100%)',
  },
  {
    id: 'pastel',
    name: 'Pastel Soft',
    desc: '부드럽고 눈에 편한 파스텔 톤',
    colors: ['#7EB8F7', '#F4A7A3', '#81D4C0', '#F9C97C'],
    header: 'linear-gradient(135deg, #4A5568 0%, #718096 100%)',
  },
  {
    id: 'material',
    name: 'Material Design',
    desc: 'Google Material 공식 팔렛트',
    colors: ['#42A5F5', '#EF5350', '#26A69A', '#FFA726'],
    header: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
  },
  {
    id: 'cool-ocean',
    name: 'Cool Ocean',
    desc: '시원하고 차분한 블루-그린 계열',
    colors: ['#0EA5E9', '#06B6D4', '#10B981', '#6366F1'],
    header: 'linear-gradient(135deg, #0C4A6E 0%, #0EA5E9 100%)',
  },
  {
    id: 'nordic',
    name: 'Nordic Frost',
    desc: '스칸디나비안 미니멀리즘',
    colors: ['#7DD3FC', '#C4B5FD', '#86EFAC', '#FED7AA'],
    header: 'linear-gradient(135deg, #1E3A5F 0%, #2E5C8A 100%)',
  },
  {
    id: 'earth',
    name: 'Earth Tones',
    desc: '자연에서 영감을 받은 어스 컬러',
    colors: ['#92400E', '#065F46', '#1E40AF', '#78350F'],
    header: 'linear-gradient(135deg, #1C1917 0%, #44403C 100%)',
  },
  {
    id: 'vivid',
    name: 'Vivid Pop',
    desc: '선명하고 에너지 넘치는 팝 컬러',
    colors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'],
    header: 'linear-gradient(135deg, #1E1B4B 0%, #3730A3 100%)',
  },
  {
    id: 'muted',
    name: 'Muted Classic',
    desc: '고급스럽고 절제된 뮤트 톤',
    colors: ['#6B8CAE', '#C47D7D', '#6DAE8C', '#C4A96D'],
    header: 'linear-gradient(135deg, #2D3748 0%, #4A5568 100%)',
  },
  {
    id: 'purple-set',
    name: 'Purple Suite',
    desc: '보라 계열 통일감 있는 팔렛트',
    colors: ['#7C3AED', '#A855F7', '#C084FC', '#E879F9'],
    header: 'linear-gradient(135deg, #2E1065 0%, #7C3AED 100%)',
  },
  {
    id: 'retro',
    name: 'Retro Studio',
    desc: '레트로 감성의 따뜻한 포인트 컬러',
    colors: ['#E76F51', '#264653', '#2A9D8F', '#E9C46A'],
    header: 'linear-gradient(135deg, #264653 0%, #2A9D8F 100%)',
  },
]

function MiniBar({ color, value }: { color: string; value: number }) {
  const max = Math.max(...VALUES)
  const pct = (value / max) * 100
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden">
        <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function DonutPreview({ colors }: { colors: string[] }) {
  const total = VALUES.reduce((a, b) => a + b, 0)
  let offset = 0
  const segments = VALUES.map((v, i) => {
    const pct = (v / total) * 100
    const seg = { color: colors[i], offset, pct }
    offset += pct
    return seg
  })
  const r = 28, cx = 32, cy = 32, circumference = 2 * Math.PI * r

  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth="10"
          strokeDasharray={`${(s.pct / 100) * circumference} ${circumference}`}
          strokeDashoffset={-((s.offset / 100) * circumference)}
          transform="rotate(-90 32 32)"
        />
      ))}
      <circle cx={cx} cy={cy} r="18" fill="white" />
    </svg>
  )
}

export default function PalettesPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">차트 팔렛트 선택</h1>
        <p className="text-sm text-slate-400 mb-8">마음에 드는 팔렛트 번호를 Claude에게 알려주세요</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PRESETS.map((p, idx) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {/* 헤더 미리보기 */}
              <div className="h-10 flex items-center px-4" style={{ background: p.header }}>
                <span className="text-white text-xs font-semibold tracking-wide opacity-80">HOUSEHOLD BUDGET</span>
              </div>

              <div className="p-4">
                {/* 번호 + 이름 */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-700 text-sm">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.desc}</p>
                  </div>
                </div>

                {/* 색상 스와치 */}
                <div className="flex gap-1.5 mb-4">
                  {p.colors.map((c, i) => (
                    <div key={i} className="flex-1">
                      <div className="h-6 rounded-md" style={{ background: c }} />
                      <p className="text-[10px] text-slate-400 mt-1 text-center truncate">{CATEGORIES[i]}</p>
                    </div>
                  ))}
                </div>

                {/* 바 차트 미리보기 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-2 font-medium">막대 차트</p>
                    {CATEGORIES.map((cat, i) => (
                      <MiniBar key={cat} color={p.colors[i]} value={VALUES[i]} />
                    ))}
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] text-slate-400 mb-2 font-medium">도넛 차트</p>
                    <DonutPreview colors={p.colors} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
