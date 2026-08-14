# 계좌 입출금 원장 (account_cashflows) — 설계

> 목표: 계좌에 실제로 넣고 뺀 돈을 기록해 **실질 투자수익**을 산출한다.
> 기존 `수량 × 평균매수단가` 기반 투자원금은 매매차익·배당 재투자를 반영하지 못하는 한계가 있다.

## 1. 핵심 공식

```
순투입     = 누적 입금 − 누적 출금
실질 수익   = 현재 평가액 − 순투입
실질 수익률 = 실질 수익 / 누적 입금
```

- 매매차익·배당 재투자·수수료·세금은 전부 평가액에 이미 반영되므로 **잔차로 자동 포착**된다.
- 배당은 계좌 밖으로 인출한 경우에만 `출금`으로 기록한다 (이중계산 방지).
- 스냅샷에 예수금(현금 자산군)을 계속 입력해야 평가액이 정확하다.

## 2. 스키마

```sql
CREATE TABLE account_cashflows (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  flow_date  date NOT NULL,
  type       text NOT NULL CHECK (type IN ('deposit','withdrawal','transfer_in','transfer_out','opening')),
  amount     numeric NOT NULL CHECK (amount > 0),   -- KRW, 항상 양수 (방향은 type이 결정)
  memo       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

| type | 의미 | 집계 방향 |
|------|------|-----------|
| `deposit` | 외부 → 계좌 입금 | 입금(+) |
| `withdrawal` | 계좌 → 외부 출금 | 출금(−) |
| `transfer_in` | 다른 계좌에서 이체받음 | 입금(+) |
| `transfer_out` | 다른 계좌로 이체 | 출금(−) |
| `opening` | 기초잔액 앵커 | 입금(+) |

- **기초잔액(opening)**: 과거 입금을 소급 입력하는 대신, 기록 시작 시점의 계좌 평가액을 1건 넣는다. 이후 이벤트만 기록하면 된다.
- **계좌 간 이체**: `transfer_out`(A) + `transfer_in`(B) 쌍으로 입력. 계좌별 수익률은 정확하고, 전체 합산에서는 서로 상쇄된다.
- 총액 컬럼 1개가 아니라 **날짜 있는 이벤트 행**으로 쌓는다 → 나중에 XIRR(금액가중 수익률)·연도별 투입금 분석 가능.

## 3. API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/portfolio/cashflows` | GET | 목록 (계좌 join). `?account_id=&year=` 필터 |
| `/api/portfolio/cashflows` | POST | 생성 (세션 필수) |
| `/api/portfolio/cashflows/[id]` | PATCH / DELETE | 수정 / 삭제 (세션 필수) |

## 4. UI

- **`/portfolio/cashflows` 페이지** (사이드바 포트폴리오 섹션에 "입출금" 추가)
  - KPI: 총 입금 / 총 출금 / 순투입 / 실질 수익(수익률)
  - 계좌별 요약 표: 입금 · 출금 · 순투입 · 평가액(실시간) · 실질수익 · 수익률
  - 이벤트 목록 (계좌/연도 필터, 추가·수정·삭제 모달)
- **포트폴리오 대시보드**: 입출금 데이터가 있으면 "실질 수익" KPI 카드 추가 (계좌 필터 반영)

## 5. 기존 스키마 정리

`sells`(건별 실현손익 수동 입력)·`portfolio_transactions`(매수/매도 원장)는 이 설계로 대체되어 폐기한다.
`price_cache`(구 가격 캐시)·`expense_memos`(UI 미연결) 및 `snapshot_id IS NULL` 고아 holdings도 함께 정리.
→ `docs/sql/2026-08-14-cleanup-unused.sql` (별도 적용, 실행 전 내용 확인)
