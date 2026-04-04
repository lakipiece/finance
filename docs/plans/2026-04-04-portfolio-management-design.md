# 주식 포트폴리오 관리 기능 설계

## 개요

가계부 앱(ledger)에 주식 투자 현황 관리 페이지와 대시보드를 추가한다.
현재 구글 시트에서 관리하는 포트폴리오 데이터를 Supabase 기반으로 이전하고,
사이트에서 직접 관리하는 형태로 발전시킨다.

## 결정 사항

- **아키텍처**: Supabase 중심 설계 (A안)
- **현재가**: Yahoo Finance API (미국/한국 주식 모두)
- **목표비율**: 자산군 단위 + 종목 단위 이중 레이어
- **데이터 입력**: 스냅샷 직접 입력 + 이후 트랜잭션 혼용

## DB 스키마

### accounts (계좌)
```sql
CREATE TABLE accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,          -- "카카오페이 종합위탁"
  broker      text NOT NULL,          -- "카카오페이"
  owner       text,                   -- 소유자명
  type        text,                   -- 종합위탁 / 연금저축 / ISA
  currency    text DEFAULT 'KRW',
  created_at  timestamptz DEFAULT now()
);
```

### securities (종목 마스터)
```sql
CREATE TABLE securities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker      text UNIQUE NOT NULL,   -- "SCHD", "005930"
  name        text NOT NULL,          -- "슈왑 배당 ETF"
  asset_class text,                   -- 주식 / 채권 / 대체자산
  country     text,                   -- US / KR
  style       text,                   -- 성장 / 인컴 / 안전
  sector      text,                   -- 테크 / 미국전체 / 미국채 등
  currency    text DEFAULT 'USD',
  created_at  timestamptz DEFAULT now()
);
```

### holdings (현재 포지션 스냅샷)
```sql
CREATE TABLE holdings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid REFERENCES accounts(id),
  security_id     uuid REFERENCES securities(id),
  quantity        numeric NOT NULL,      -- 현재 보유수량
  avg_price       numeric,               -- 평균매입가 (직접 입력 가능)
  total_invested  numeric,               -- 투자원금 (직접 입력 가능)
  snapshot_date   date NOT NULL,
  source          text DEFAULT 'manual', -- manual / calculated
  updated_at      timestamptz DEFAULT now()
);
```

### transactions (매수/매도 이력)
```sql
CREATE TABLE portfolio_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid REFERENCES accounts(id),
  security_id     uuid REFERENCES securities(id),
  type            text NOT NULL,         -- buy / sell
  date            date NOT NULL,
  quantity        numeric NOT NULL,
  price_per_unit  numeric NOT NULL,
  currency        text DEFAULT 'USD',
  exchange_rate   numeric DEFAULT 1,     -- 원화 환산용
  fees            numeric DEFAULT 0,
  notes           text,
  created_at      timestamptz DEFAULT now()
);
```

### dividends (분배금/배당 이력)
```sql
CREATE TABLE dividends (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid REFERENCES accounts(id),
  security_id   uuid REFERENCES securities(id),
  date          date NOT NULL,
  amount        numeric NOT NULL,
  currency      text DEFAULT 'USD',
  exchange_rate numeric DEFAULT 1,
  notes         text,
  created_at    timestamptz DEFAULT now()
);
```

### target_allocations (목표 비율)
```sql
CREATE TABLE target_allocations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level       text NOT NULL,   -- asset_class / sector / ticker
  key         text NOT NULL,   -- "주식" / "테크" / "SCHD"
  target_pct  numeric NOT NULL -- 0.0 ~ 1.0
);
```

### price_cache (현재가 캐시)
```sql
CREATE TABLE price_cache (
  ticker      text PRIMARY KEY,
  price       numeric NOT NULL,
  currency    text DEFAULT 'USD',
  fetched_at  timestamptz DEFAULT now()
);
```

## 집계 로직

- **보유수량**: holdings.quantity (기준) + 이후 transactions에서 증감
- **평균매입가**: holdings.avg_price (직접입력) 또는 transactions에서 가중평균 계산
- **평가금액**: 보유수량 × 현재가 (price_cache에서)
- **평가손익**: 평가금액 - 투자원금
- **실현손익**: 매도 시 (매도가 - 평균매입가) × 매도수량
- **총수익**: 평가손익 + 실현손익 + 누적 분배금

환율: USD 종목은 exchange_rate 컬럼으로 원화 환산, 대시보드는 KRW 기준 통합

## 페이지 구성

```
/portfolio                    메인 대시보드
/portfolio/accounts           계좌 관리 (CRUD)
/portfolio/holdings           종목별 보유 현황 + 트랜잭션 입력
/portfolio/rebalance          목표비율 설정 + 리밸런싱 가이드
/portfolio/import             구글시트 → Supabase import
```

### /portfolio 대시보드

**KPI 카드 (상단)**
- 총 평가금액 / 총 투자원금 / 총 손익(금액) / 총 수익률(%)
- 총 누적 분배금

**차트 (중단) — 드릴다운 구조**
- 자산군별 파이차트 (주식/채권/대체자산)
- 국가별 비중 (US/KR)
- 섹터별 바차트
- 계좌별 비교 바차트

**종목 테이블 (하단)**
- 티커 / 종목명 / 보유수량 / 평균매입가 / 현재가 / 평가금액 / 손익 / 수익률
- 현재가: Yahoo Finance API, TTL 1시간 캐시

### /portfolio/rebalance

**자산군 레이어**
| 자산군 | 목표 | 현재 | 차이 |
|--------|------|------|------|
| 주식   | 60%  | 67%  | +7%  |

**종목 레이어**
| 종목  | 목표 | 현재  | 차이   | 필요 금액    |
|-------|------|-------|--------|-------------|
| SCHD  | 10%  | 9.3%  | -0.7%  | +₩150,000  |

## 현재가 API

- **라이브러리**: `yahoo-finance2` (Node.js)
- **한국 주식**: ticker에 `.KS`(KOSPI) / `.KQ`(KOSDAQ) 접미사 사용
- **캐시 전략**: price_cache 테이블, fetched_at 기준 1시간 TTL
- **API 엔드포인트**: `GET /api/portfolio/prices?tickers=SCHD,005930.KS`

## 구글시트 Import (Phase 1)

- 기존 가계부 import 패턴 재사용
- 포트폴리오 시트에서 holdings 초기 데이터 일괄 import
- 컬럼 매핑: 티커 → securities, 계좌 → accounts, 수량/평균가 → holdings

## 향후 확장 (Phase 2)

- 사이트에서 직접 매수/매도/분배금 입력
- 변경 내역 → 구글시트로 export
- 환율 자동 fetch (한국은행 또는 Yahoo Finance)
