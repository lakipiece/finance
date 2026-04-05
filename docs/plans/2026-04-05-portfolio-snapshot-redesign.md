# Portfolio Snapshot Redesign

**Date:** 2026-04-05

---

## Goal

포트폴리오 관리 방식을 스냅샷 기반으로 전환하고, 수익(매도/배당) 관리 및 상단 네비게이션 구조를 개선한다.

---

## DB Schema

### 신규 테이블

```sql
-- 스냅샷 그룹
CREATE TABLE snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 매도 기록
CREATE TABLE sells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES snapshots(id),
  security_id uuid REFERENCES securities(id) NOT NULL,
  account_id uuid REFERENCES accounts(id) NOT NULL,
  sold_at date NOT NULL,
  quantity numeric NOT NULL,
  avg_cost_krw numeric,
  sell_price_krw numeric,
  realized_pnl_krw numeric,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 배당/분배금
CREATE TABLE dividends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id uuid REFERENCES securities(id) NOT NULL,
  account_id uuid REFERENCES accounts(id) NOT NULL,
  paid_at date NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  tax numeric NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz DEFAULT now()
);
```

### 기존 테이블 변경

```sql
ALTER TABLE holdings ADD COLUMN snapshot_id uuid REFERENCES snapshots(id);
```

기존 holdings 데이터: 초기 스냅샷(date = 가장 최근 snapshot_date) 하나 생성 후 snapshot_id 일괄 연결.

---

## Navigation Structure

### 상단 탭 전환

타이틀 영역에 가계부 / 포트폴리오 전환 토글 추가. URL prefix로 자동 감지.

```
[가계부]  [포트폴리오]
────────────────────────────────
가계부:      대시보드 | 연도비교 | 검색 | 관리
포트폴리오:  대시보드 | 스냅샷 | 수익 | 관리
```

### 포트폴리오 하위 메뉴

| 메뉴 | URL | 내용 |
|------|-----|------|
| 대시보드 | `/portfolio` | KPI 카드, 배분 차트, 보유현황 테이블 |
| 스냅샷 | `/portfolio/snapshots` | 스냅샷 목록 + 만들기 + 편집 + 추이 차트 |
| 수익 | `/portfolio/income` | 매도 기록 + 배당 기록 + 차트 |
| 관리 | `/portfolio/settings` | 계좌/종목/목표비율/import 통합 |

---

## Page Designs

### 스냅샷 페이지 (`/portfolio/snapshots`)

1. **목록**: 날짜별 카드 — 총평가금액, 직전 대비 증감(금액, %)
2. **만들기**: 직전 스냅샷 holdings 복제 → 새 snapshot 레코드 생성 → 편집 화면 이동
3. **편집**: 종목별 수량 / 평균매입가 인라인 수정 테이블. 계좌 > 종목 계층 구조.
4. **차트**:
   - 라인 차트: X = 스냅샷 날짜, Y = 총평가금액
   - 스택 바: 동일 X축, Y = 종목별/자산군별 비중 % (토글)

### 수익 페이지 (`/portfolio/income`)

- KPI 카드: 총 실현손익, 총 배당수익, 합산 수익
- 매도 기록 테이블 + 입력 폼
- 배당 기록 테이블 + 입력 폼
- 차트: 월별 실현손익 바, 월별 배당 바 (종목별 색상)

### 포트폴리오 대시보드 (`/portfolio`)

가장 최근 스냅샷 + 오늘 시세 기준.
- KPI: 총평가금액, 투자원금, 평가손익(%), 수령배당금
- 파이/도넛: 자산군별 / 국가별 비중
- 보유현황 테이블: 계좌 > 종목 계층 (현재 유지)

---

## Price History

`price_history` 테이블 유지. 스냅샷 생성 시 또는 대시보드 진입 시 DB에서 읽어 평가금액 계산.
스냅샷 차트의 과거 시점 평가금액은 해당 날짜의 price_history 레코드와 스냅샷 holdings를 JOIN해서 계산.

---

## Migration Plan

1. Supabase에서 신규 테이블 3개 생성
2. `holdings`에 `snapshot_id` 컬럼 추가
3. 기존 holdings 중 가장 최근 snapshot_date 기준으로 초기 snapshot 레코드 생성
4. 해당 snapshot_id를 holdings에 일괄 UPDATE
5. 구 snapshot_date 컬럼은 nullable로 유지 (하위 호환)
