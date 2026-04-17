# Sidebar Layout Redesign

**Date:** 2026-04-18
**Branch:** design/sidebar-layout
**Reference:** Metric Slate / Household Ledger UI

## Goal

Replace the current top `HeaderBar` + `TabNav` with a left sidebar navigation, matching the Metric Slate reference design. Page components remain untouched.

## Decisions

| Question | Decision |
|---|---|
| 모드 전환 방식 | 완전 분리 — 모드 전환 시 사이드바 전체 교체 (Option C) |
| 브랜딩 | 로고/아이콘만, 텍스트 없음 |
| CTA 버튼 | 가계부: `+ 지출 추가`, 포트폴리오: `+ 스냅샷 추가` |
| 모바일 | 햄버거 메뉴 → 사이드바 슬라이드 인/아웃 + 오버레이 |
| 모드 전환 버튼 순서 | 포트폴리오 → 가계부 |

## Layout Structure

```
┌─────────────┬──────────────────────────────────┐
│  Sidebar    │  Main Content                    │
│  220px      │  flex-1, overflow-y-auto         │
│  fixed      │  ml-[220px] (데스크탑)            │
│  h-screen   │                                  │
└─────────────┴──────────────────────────────────┘
```

- 데스크탑(`md+`): 사이드바 고정 노출, main에 `ml-[220px]`
- 모바일(`< md`): 사이드바 `translate-x-[-220px]` 숨김, 햄버거 버튼으로 슬라이드 토글

## Sidebar Navigation

### 가계부 모드 (`/expenses`, `/monthly`, `/compare`, `/search`, `/settings`)

```
[Logo Icon]
[ + 지출 추가 ]
──────────────
대시보드    /expenses
월별        /monthly
연도비교    /compare
검색        /search
설정        /settings
──────────────
[포트폴리오] [가계부✓]   ← 하단 모드 전환
```

### 포트폴리오 모드 (`/portfolio/**`)

```
[Logo Icon]
[ + 스냅샷 추가 ]
──────────────
대시보드    /portfolio
스냅샷      /portfolio/snapshots
배당        /portfolio/income
계좌        /portfolio/accounts
종목        /portfolio/securities
옵션        /portfolio/options
리밸런싱    /portfolio/rebalance
설정        /portfolio/settings
──────────────
[포트폴리오✓] [가계부]   ← 하단 모드 전환
```

## Color Tokens

| Element | Value |
|---|---|
| 사이드바 배경 | `white` |
| 사이드바 우측 border | `border-r border-slate-200` |
| 활성 nav 배경 | `bg-slate-800 text-white rounded-lg` |
| 비활성 nav | `text-slate-500 hover:bg-slate-100 rounded-lg` |
| CTA 버튼 | `bg-slate-800 text-white` (hover: `bg-slate-700`) |
| 모드 전환 버튼 | `bg-slate-100 text-slate-600 rounded-lg` |
| Main 배경 | `#f8f9ff` (기존 유지) |
| 폰트 | Noto Sans KR + Manrope (기존 유지) |

## Components

### New
- `components/SidebarLayout.tsx` — 사이드바 + main 래퍼, 모바일 햄버거 상태 관리
- `components/Sidebar.tsx` — 사이드바 콘텐츠 (모드별 분기, nav 링크, CTA, 모드 전환)

### Modified
- `app/layout.tsx` — `<HeaderBar />` → `<SidebarLayout>`

### Removed (or kept unused)
- `components/HeaderBar.tsx`
- `components/TabNav.tsx`
- `components/TopModeToggle.tsx`

## Out of Scope

- 페이지 컴포넌트 내부 변경 없음
- 새로운 기능 추가 없음
- `lib/styles.ts` 변경 없음
