# Dividend & Snapshot Enhancements — Design

**Date:** 2026-04-20
**Scope:** 배당 대시보드 개편 + 스냅샷 편집 UI 보강

## 목표

1. 계좌별 세율·배당대상 관리 → 실제 수령 세후 금액이 계좌 특성(연금저축/ISA/일반) 에 맞게 산정
2. 배당 입력 동선 단축 — 한 계좌의 여러 종목을 한 번에 입력
3. 배당 집계를 월/계좌/종목 3축으로 드릴다운
4. 가계부의 "월 선택 → 상·하단 동기화" 패턴을 배당에도 이식
5. 스냅샷 편집에서 섹터 색상과 원금/평가금액 병기로 가독성 향상

---

## 1. DB 스키마 변경

### accounts 테이블
```sql
ALTER TABLE accounts
  ADD COLUMN dividend_eligible  boolean NOT NULL DEFAULT true,
  ADD COLUMN dividend_tax_rate  numeric(5,2);  -- % 단위

-- 초기값 일괄 적용
UPDATE accounts SET dividend_tax_rate = 5.50  WHERE type = '연금저축';
UPDATE accounts SET dividend_tax_rate = 9.90  WHERE type = 'ISA';
UPDATE accounts SET dividend_tax_rate = 15.00 WHERE broker = '카카오페이' AND dividend_tax_rate IS NULL;
UPDATE accounts SET dividend_tax_rate = 15.40 WHERE dividend_tax_rate IS NULL;
```

- `dividend_eligible` — `false` 인 계좌는 배당 입력 모달의 계좌 드롭다운에서 제외
- `dividend_tax_rate` — 배당 입력 시 세금 자동계산의 기본값 (override 가능)

### 마이그레이션 스크립트
`scripts/` 에 idempotent SQL 추가 → 로컬/프로덕션 각각 수동 실행.

---

## 2. 계좌관리 UI

`AccountsManager.tsx` 계좌 편집 모달에 필드 추가:
- 체크박스 "배당 대상 계좌"
- 숫자 입력 "배당 세율 (%)" · 기본 placeholder는 type/broker 규칙에 따른 추천값 표시

`/api/portfolio/accounts` (POST/PATCH) 에서 두 필드 read/write 지원.

---

## 3. 배당 대시보드 (`IncomeDashboard`) 개편

### 3-1. KPI 카드 라벨 변경 및 월 연동
- `납부 세금` → **추정 세금**
- `세후 수령액` → **세후 배당금**
- `selectedMonth` 상태 존재 시 카드 값·서브타이틀이 해당 월 기준으로 전환
  - 미선택: `{year}년 총 수령액` 등 연간 합계
  - 선택: `{year}-MM 수령액` 등 월별 합계

### 3-2. 차트 집계 탭
상단에 탭 UI 추가: **[월별] [계좌별] [종목별]**

- 월별 (기본): 기존 월별 bar chart 유지. 바 클릭 → `selectedMonth` 토글 → 하단 KPI, 드릴다운 도넛, DividendTable 동기화
- 계좌별: 계좌명 x-axis, 해당 연(또는 선택한 월) 수령액 누계
- 종목별: 티커 x-axis, 해당 연(또는 선택한 월) 수령액 누계. 상위 N개 컷 + 나머지 "기타"

모든 탭은 `selectedMonth` 가 지정되어 있으면 해당 월 범위 기준으로 집계.

### 3-3. 테이블 월 필터
`DividendTable` 이 `selectedMonth` prop 을 받아 해당 월만 표시. 검색/정렬/페이지네이션은 그대로 작동.

---

## 4. 배당 입력 UX — BulkDividendModal

**기존 DividendFormModal 을 대체. 수정 동선은 단건으로 유지 (기존 모달 재사용 또는 같은 모달을 단건 모드로 열기).**

### 구조
```
┌─ 계좌 사용자 pill
├─ 계좌 선택 (dividend_eligible=true 만)
├─ 수령일 (DateInput)
├─ 통화 · 환율 (USD 선택 시)
└─ 종목 카드 리스트 (계좌 linked securities)
    ┌ [TICKER] 종목명
    │   금액 · 세금(자동=amount * tax_rate/100, override) · 메모
    └ ...
```

### 저장 로직
- 값(금액 > 0) 있는 종목만 추출 → 각각 `POST /api/portfolio/dividends` 로 순차 생성 (Promise.all)
- 실패 건은 UI 상단에 에러 토스트, 성공 건은 그대로 유지

### 수정
- 기존 테이블의 수정 버튼 → 해당 1건 단독 편집 모달 (기존 `DividendFormModal` 슬림화 또는 BulkDividendModal의 `editTarget` 분기)

---

## 5. 스냅샷 편집 (`SnapshotEditor`) 보강

### 5-1. 티커 색상
- 계좌 모달 카드의 티커 배지에 `sectorColors[security.sector]` 배경/텍스트 적용 (AccountsManager 패턴 재사용)
- `SnapshotEditor` Props 에 `sectorColors?: Record<string, string>` 추가, 페이지 loader 에서 `option_list` 로 조회 후 주입

### 5-2. 원금 / 평가금액 병기
- **헤더 우측**: `원금 X · 평가금액 Y` 두 값을 나란히
- **계좌 카드 하단**: 현재 평가금액 자리를 `원금 / 평가금액` 2줄로
- **모달 헤더**: 현재 `평가금액 ...` 아래 `원금 ...` 한 줄 추가

원금 = `sum(quantity * avg_price)` (통화 혼재시 USD 는 현재 환율 고려 불가 → KRW avg_price 전제. USD 계좌 처리는 추후 개선 사항으로 넘김).

---

## 영향 범위

| 파일 | 변경 종류 |
|------|----------|
| `docs/portfolio-schema.sql` | accounts 컬럼 추가 |
| `scripts/migrate-accounts-dividend.sql` | 신규 |
| `app/api/portfolio/accounts/route.ts` | POST/PATCH 필드 추가 |
| `components/portfolio/AccountsManager.tsx` | 편집 모달 필드 추가 |
| `lib/portfolio/types.ts` | Account 타입 필드 추가 |
| `app/portfolio/income/page.tsx` | accounts 쿼리에 신규 필드 포함 |
| `components/portfolio/IncomeDashboard.tsx` | 탭, 월 연동, 라벨, filter prop 전달 |
| `components/portfolio/DividendTable.tsx` | selectedMonth prop 추가 |
| `components/portfolio/BulkDividendModal.tsx` | 신규 |
| `components/portfolio/DividendFormModal.tsx` | 단건 수정 모드로 축소 또는 BulkModal에 병합 |
| `components/portfolio/SnapshotEditor.tsx` | sectorColors 적용, 원금 표시 |
| `app/portfolio/snapshots/[id]/page.tsx` | sectorColors loader 추가 |

---

## 비결정 사항 (추후 필요시)

- USD 계좌의 "원금" 산정(USD avg_price * 당시 환율) 은 현재 데이터 모델로 불가능 → 스냅샷 편집에서는 KRW 전제. 환율 기반 원금은 후속 과제.
- 배당 입력 세율 override 이력은 별도 저장하지 않음 (dividends.tax 값만 저장).

---

## 수용 기준

1. 연금저축/ISA/카카오페이 계좌의 신규 배당 입력 시 세금이 5.5/9.9/15.0 으로 자동 제안
2. `dividend_eligible=false` 계좌는 BulkDividendModal 드롭다운에 나타나지 않음
3. 한 계좌의 3개 종목을 동시에 입력하여 3개 dividends 레코드가 생성
4. 월/계좌/종목 탭을 전환하며 집계 확인 가능
5. 월 바 클릭 시 KPI, 드릴다운, 테이블 모두 해당 월로 필터링
6. 스냅샷 편집 티커 배지에 섹터 색상이 반영
7. 스냅샷 편집 상단에 원금·평가금액 두 수치가 표시
