import type { Config } from 'tailwindcss'

// ─── The Orchestrated Lens: Surface 토큰 색상 체계 ──────────────────────────
// 경계선 대신 배경색 레이어링으로 깊이를 표현한다.
// surface (Foundation) > surface-low (Canvas) > surface-card (High-Focus Card)

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surface 계층 (배경 레이어링)
        surface: {
          DEFAULT: '#f8f9ff',      // Foundation — 앱 최상위 배경
          low: '#eff4ff',          // Canvas — 사이드바, 보조 영역
          container: '#e6eeff',    // Container — 구분 존
          'container-high': '#dce9ff', // Container High — 보조 버튼 배경
          dim: '#ccdbf3',          // Dim — 비활성 사이드바 상태
          card: '#ffffff',         // High-Focus Card — 주요 카드 ("팝업")
        },
        // 기본 색상
        'primary-container': '#131b2e', // 다크 네이비 — 주요 CTA
        'on-surface': '#0d1c2e',        // 깊은 네이비 텍스트 (pure black 금지)
        'outline-variant': '#c6c6cd',   // Ghost Border 기준
      },
      fontFamily: {
        manrope: ['var(--font-manrope)', 'Manrope', 'sans-serif'],
      },
      backdropBlur: {
        glass: '20px',
      },
    },
  },
  plugins: [],
}

export default config
