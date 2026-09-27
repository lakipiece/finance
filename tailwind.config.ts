import type { Config } from 'tailwindcss'

// ─── 시안 D 디자인 토큰 ────────────────────────────────────────────────────
// B안의 표면 언어(테두리 0 · 배경 톤 이동 + 확산 그림자) × C안의 정보 밀도.
// 표면 램프는 전면 중성 한 벌만 존재한다. 폼·대시보드 구분 없음.
// 청색 램프(#f8f9ff #eff4ff #e6eeff #dce9ff #ccdbf3)는 폐기됨.

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 표면 램프 (D-00) — 전면 중성
        surface: {
          DEFAULT: '#fafafb',   // 앱 배경 · 화면 바닥 · 모달 푸터
          low: '#f1f3f7',       // 인풋 채움 · 구분선 · 사이드바
          container: '#e9ecf2', // 구분 존 · 차트 그리드
          high: '#e0e4ec',      // 보조 버튼 배경 — 실제 액션 전용
          card: '#ffffff',      // 카드
        },
        // 텍스트 계층 (잉크)
        ink: {
          DEFAULT: '#0d1c2e',   // 기본 텍스트 · 금액
          2: '#3d4a5c',         // 표 내역 · 배지 글자
          3: '#5b6a80',         // 폼 라벨 · 보조 설명
          4: '#8794a8',         // 캡션 · 날짜 · 부가 정보
          5: '#a8b3c4',         // 표 헤더 · 플레이스홀더 · 셰브론
        },
        // 의미색
        income: '#237A8C',      // 수입 · 입금 · 수지 흑자 — 딥 오션 (2026-09, 초록 폐기)
        'on-surface': '#0d1c2e',
        warning: '#C25B4B',     // 예산 초과 · 임박 · 이상 거래 — 딥 살몬 (F 팔레트 톤)
        action: '#131b2e',      // 주 버튼 · 선택 상태 · 포커스 링
        gain: '#C4495E',        // 포트폴리오 상승 — 가계부에 쓰지 않음 (F 톤으로 누른 로즈 레드)
        'gain-soft': '#E08C98', // 상승 — 차트 면 전용
        loss: '#3E6BAE',        // 포트폴리오 하락 — 가계부에 쓰지 않음 (F 톤으로 누른 데님)
        'loss-soft': '#6C8EBF', // 하락 — 차트 면 전용
        // 오류 — gain과 같은 값이지만 의미가 다르다. 인풋 오류·삭제 확인에만 쓴다.
        // (gain은 "수익", danger는 "잘못됨". 같은 빨강이라도 자리를 섞지 않는다.)
        danger: '#C4495E',
      },
      fontFamily: {
        sans: [
          'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
          'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif',
        ],
      },
      // 크기 7단 — 9px 이하 금지, 임의 픽셀값 금지 (D-08a)
      fontSize: {
        display: ['22px', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '700' }],
        title:   ['20px', { lineHeight: '1.2',  fontWeight: '700' }],
        heading: ['15px', { lineHeight: '1.3',  fontWeight: '700' }],
        subhead: ['13px', { lineHeight: '1.4',  fontWeight: '500' }],
        body:    ['12px', { lineHeight: '1.5',  fontWeight: '400' }],
        meta:    ['11px', { lineHeight: '1.4',  fontWeight: '500' }],
        micro:   ['10px', { lineHeight: '1.4',  letterSpacing: '0.08em', fontWeight: '500' }],
      },
      borderRadius: {
        dialog: '18px',  // 모달 다이얼로그 · 대시보드 외곽 컨테이너
        card: '16px',    // 카드 · KPI 카드
        field: '11px',   // 인풋 · 필드
        btn: '10px',     // 버튼 · 세그먼트 컨트롤
        cell: '7px',     // 인라인 입력 행 내부 필드
      },
      // 그림자 3종만
      boxShadow: {
        card: '0 4px 32px 0 rgba(13,28,46,.06)',
        dialog: '0 12px 48px -8px rgba(13,28,46,.28)',
        focus: '0 0 0 2px #131b2e',
        error: '0 0 0 1.5px rgba(196,73,94,.35)',
      },
      backdropBlur: {
        overlay: '6px',
      },
    },
  },
  plugins: [],
}

export default config
