# 신규 기능 설계 — 지출입력 / 수입 / 유형자산 / 종목태그

**Date:** 2026-04-24  
**Scope:** 가계부 단건 입력 · 수입 관리 · 유형자산 추적 · 종목 태그 필터

---

## 전체 구조 방침

기존 사이드바(`가계부` / `포트폴리오`) 구조를 유지하면서 새 라우트 2개(`/income`, `/assets`)를 추가한다. 각 기능은 독립적으로 구현하되, 가계부 대시보드와 포트폴리오 대시보드에 요약 카드/차트를 연동한다.

---

## 1. DB 스키마

### 1-1. 지출 비고 항목 (`expense_memos`)

현재 `expenses.memo`(단일 텍스트)는 유지하고, 다중 비고는 별도 테이블로 관리한다.

```sql
CREATE TABLE expense_memos (
  id         BIGSERIAL PRIMARY KEY,
  expense_id BIGINT REFERENCES expenses(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,     -- 비고 항목명 (예: '식비', '생필품')
  amount     INTEGER,           -- NULL = 금액 없이 텍스트만
  sort_order SMALLINT DEFAULT 0
);
```

**총액 결정 로직**
- `expense_memos`에 `amount`가 하나라도 있으면 → 합산 → `expenses.amount` 자동 설정
- 없으면 → `expenses.amount` 직접 입력값 사용

### 1-2. 수입 (`incomes`)

```sql
CREATE TABLE incomes (
  id           BIGSERIAL PRIMARY KEY,
  income_date  DATE NOT NULL,
  year         SMALLINT NOT NULL,
  month        SMALLINT NOT NULL,
  category     TEXT NOT NULL,    -- '급여' | '보너스' | '기타'
  description  TEXT DEFAULT '',
  amount       INTEGER NOT NULL,
  member       TEXT,             -- 'L' | 'P' (expenses와 동일 패턴)
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### 1-3. 유형자산 (`tangible_assets` + `asset_valuations`)

```sql
CREATE TABLE tangible_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  asset_type        TEXT NOT NULL,      -- '부동산' | '연금' | '차량' | '기타'
  description       TEXT DEFAULT '',
  acquired_at       DATE,
  acquisition_price BIGINT,            -- 취득가액 (원)
  acquisition_note  TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE asset_valuations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID REFERENCES tangible_assets(id) ON DELETE CASCADE,
  val_date   DATE NOT NULL,
  amount     BIGINT NOT NULL,           -- 추정 시세 (원)
  note       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id, val_date)
);
```

**현재 가치** = 해당 자산의 가장 최신 `val_date` 레코드의 `amount`  
**평가손익** = 현재 가치 − 취득가액

### 1-4. 종목 태그 (`security_tags`)

```sql
CREATE TABLE security_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id UUID REFERENCES securities(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  UNIQUE(security_id, tag)
);
```

---

## 2. API 라우트

| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/expenses/create` | POST | 단건 지출 삽입 (+ expense_memos) |
| `/api/expenses/[id]` | PATCH / DELETE | 단건 수정/삭제 |
| `/api/incomes` | GET / POST | 수입 목록 조회 / 추가 |
| `/api/incomes/[id]` | PATCH / DELETE | 수입 수정/삭제 |
| `/api/incomes/summary` | GET | 연간·월별 집계 |
| `/api/assets` | GET / POST | 유형자산 목록 / 추가 |
| `/api/assets/[id]` | PATCH / DELETE | 자산 수정/삭제 |
| `/api/assets/[id]/valuations` | GET / POST | 시세 이력 조회 / 추가 |
| `/api/portfolio/securities/[id]/tags` | GET / POST / DELETE | 종목 태그 관리 |

---

## 3. UI 컴포넌트

### 3-1. 가계부 지출 입력 모달

**진입점**: 가계부 대시보드(`/expenses`) 우상단 `+ 지출 입력` 버튼

**컴포넌트**: `ExpenseCreateModal.tsx`

**필드:**
- 날짜 (date picker, 기본값: 오늘)
- 작성자 (L / P 토글)
- 지출유형 (고정비 / 대출상환 / 변동비 / 여행공연비)
- 세부유형 (`detail` 텍스트 입력)
- 결제수단 (`method` 텍스트 입력)
- 입력 모드 토글: **직접 입력** vs **항목별 입력**
  - 직접 입력: 금액 숫자 필드 1개
  - 항목별 입력: `[항목명] [금액(선택)]` 행 n개 + `+ 항목 추가` 버튼, 하단 자동 합산 표시

저장 후 대시보드 데이터 자동 갱신.

---

### 3-2. 수입 관리 (`/income`)

**사이드바**: 가계부 섹션 하단에 `수입` 항목 추가

**페이지 컴포넌트**: `IncomeClient.tsx`

**구성:**
- 상단 KPI 카드: 연간 총 수입 / 월 평균 / 카테고리별 비중
- 월별 수입 바 차트
- 수입 내역 테이블 (날짜 / 카테고리 / 설명 / 금액 / 작성자)
- `+ 수입 입력` 버튼 → `IncomeFormModal.tsx` (날짜, 카테고리, 설명, 금액, 작성자)

**가계부 대시보드 연동:**
- KPI 카드 영역에 "연간 수입" 카드 1개 추가
- 월별 차트(`MonthlyChart`)에 수입 라인 오버레이 (보조축)

---

### 3-3. 유형자산 (`/assets`)

**사이드바**: 독립 메뉴 `자산` 추가

**페이지 컴포넌트**: `AssetsClient.tsx`

**구성:**
- 상단 KPI 카드: 유형자산 총액 / 총 취득가액 / 총 평가손익
- 자산 카드 리스트 (자산명 / 유형 배지 / 취득가 / 현재 추정가 / 평가손익 %)
- 자산 클릭 → 시세 이력 차트 + `평가액 업데이트` 버튼
- `+ 자산 추가` 버튼 → `AssetFormModal.tsx`

**포트폴리오 대시보드 연동:**
- KPI 카드에 `유형자산 합계` 카드 추가

---

### 3-4. 종목 태그

**진입점**: SecuritiesManager 종목 편집 모달

**UI**: 태그 칩 입력 (입력 후 Enter/쉼표로 추가, ×로 삭제)

**포트폴리오 대시보드 필터:**
- 기존 필터 바에 태그 드롭다운 추가
- 선택 시 해당 태그가 붙은 종목의 포지션만 표시
- 복수 태그 선택 시 OR 조건

---

## 4. 구현 순서

독립성이 높으므로 기능별로 순차 구현 권장:

1. **종목 태그** — DB 1개, API 1개, UI 수정 2곳. 가장 작음.
2. **가계부 지출 입력 모달** — 기존 스키마 확장 + 단건 API + 모달 컴포넌트
3. **수입 관리** — 새 테이블 + API 4개 + 페이지 + 대시보드 연동
4. **유형자산** — 새 테이블 2개 + API 5개 + 페이지 + 시세 차트
