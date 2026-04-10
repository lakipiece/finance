# Settings & Snapshot Cards Redesign

## Goal

1. 옵션 관리 설정 페이지 — 계좌유형, 국가, 통화, 자산군, 섹터를 DB에서 CRUD, 색상 커스텀
2. 계좌 정렬 — 드래그앤드롭으로 계좌 표시 순서 변경
3. 스냅샷 카드 리디자인 — 평가액/P&L/섹터 비중 표시 (DB에 저장, 버튼으로 업데이트)
4. 스냅샷 차트 — 저장된 total_market_value로 빠르게 렌더링

---

## Architecture

### 1. 옵션 관리 (Settings)

**DB: `option_list` 테이블**
```sql
CREATE TABLE option_list (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL,   -- account_type | country | currency | asset_class | sector
  label        text NOT NULL,
  value        text NOT NULL,
  color_hex    text,            -- e.g. "#3b82f6"
  sort_order   int DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (type, value)
);
```

초기 시드 데이터:
- account_type: CMA, ISA, IRP, 증권, 은행, 연금저축
- country: 국내(#10b981), 미국(#3b82f6), 글로벌(#f59e0b), 기타(#94a3b8)
- currency: KRW(#10b981), USD(#3b82f6)
- asset_class: 주식(#3b82f6), 채권(#8b5cf6), 현금(#14b8a6), 코인(#f97316)
- sector: IT, 금융, 헬스케어, 소비재, 에너지, 산업재, 기타

**API: `/api/portfolio/options`**
- `GET` → `{ [type]: [{ id, label, value, color_hex, sort_order }] }`
- `POST` body `{ type, label, value, color_hex }` → 생성
- `PATCH /:id` body `{ label?, color_hex?, sort_order? }` → 수정
- `DELETE /:id` → 삭제

**설정 페이지: `/portfolio/settings`**
- 기존 설정 페이지에 "옵션 관리" 섹션 추가
- 탭: 계좌유형 / 국가 / 통화 / 자산군 / 섹터
- 각 탭: 옵션 목록 (색상 동그라미 + 라벨 + 삭제버튼), 하단 추가 폼
- 색상 피커: 12색 프리셋 스와치 (inline, 별도 라이브러리 없이)

**SecuritiesManager 연동**
- 하드코딩된 배열을 `GET /api/portfolio/options` 조회로 교체
- 카드 색상: `color_hex`를 `style={{ backgroundColor, color, borderColor }}` 인라인으로 적용

### 2. 계좌 정렬 (sort_order on accounts)

**DB**
```sql
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;
```

**계좌관리 페이지 (`AccountsManager`)**
- `@dnd-kit/core` + `@dnd-kit/sortable` 사용 (이미 Next.js 환경에 적합)
- 드래그핸들 아이콘(⠿) 각 계좌 행/카드 좌측에
- 드롭 후 `PATCH /api/portfolio/accounts/reorder` 호출 → `[{ id, sort_order }]` 배열 저장
- 모든 계좌 조회 시 `ORDER BY sort_order ASC, created_at ASC`

### 3. 스냅샷 평가액 저장

**DB**
```sql
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS total_market_value numeric;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS total_invested     numeric;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS sector_breakdown   jsonb;  -- { "IT": 32.1, "금융": 18.5 }
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS value_updated_at   timestamptz;
```

**계산 API: `POST /api/portfolio/snapshots/refresh-values`**
- 모든 스냅샷 순회
- 각 스냅샷: holdings JOIN securities → price_history (date ≤ snapshot.date) → KRW 환산
- `total_market_value`: 수량 × 시장가 합계
- `total_invested`: 수량 × avg_price 합계 (KRW 환산)
- `sector_breakdown`: 섹터별 비중 % (섹터 없으면 asset_class로 fallback)
- 결과를 `snapshots` 테이블에 UPDATE

### 4. 스냅샷 카드 디자인

**그리드: 2~3 컬럼** (현재 7컬럼 → 2~3컬럼으로 확대)

**카드 레이아웃:**
```
┌──────────────────────────────────────────────────────┐
│ 2026-04                          124,500,000원       │
│ 2026-04-10                   +3,200,000원 (+2.6%)    │
│                                                      │
│ IT 32% · 금융 18% · 채권 15% · 기타 35%              │
│                                        [편집] [삭제] │
└──────────────────────────────────────────────────────┘
```

- YYYY-MM: `text-base font-bold text-slate-800`
- YYYY-MM-DD: `text-xs text-slate-400` (서브타이틀)
- 평가액: `text-xl font-bold text-slate-800` 우측정렬
- P&L: `text-sm font-medium` 우측정렬, 양수=green-600, 음수=red-500, 0=slate-400
- 섹터 비중: `text-[10px] text-slate-400` 하단, `·` 구분
- 평가액 없는 경우 "—" 표시
- 최신 뱃지 유지

**"전체 평가액 업데이트" 버튼**
- 스냅샷 목록 상단 우측
- 클릭 시 `POST /api/portfolio/snapshots/refresh-values` 호출
- 로딩 중 버튼 disabled + 스피너

### 5. 스냅샷 차트

- `SnapshotCharts`의 데이터 소스를 `page.tsx` price_history 재계산 → DB의 `total_market_value` 직접 읽기로 교체
- 최신 5개 제한 제거 → 전체 스냅샷 표시
- 2개 이상일 때 표시 유지

---

## Navigation 추가

`TabNav.tsx`의 `PORTFOLIO_TABS`에 `설정` 탭 추가 (`/portfolio/settings`)

---

## Tech Stack

- Drag and drop: `@dnd-kit/core` + `@dnd-kit/sortable`
- 색상 피커: 프리셋 12색 스와치 (라이브러리 없이 구현)
- 차트: 기존 Recharts 유지
