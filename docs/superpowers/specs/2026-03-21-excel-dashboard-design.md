# 엑셀 기반 가계부 대시보드 설계 문서

**날짜:** 2026-03-21
**프로젝트:** 2022 가계부 대시보드 (Next.js + Vercel)

---

## 목표

`data/2022 가계부.xlsx` 엑셀 파일을 기반으로 인터랙티브 대시보드 웹앱을 구축하고 Vercel에 배포한다. 향후 파일 추가 시 연도별 확장이 가능한 구조로 설계한다.

---

## 엑셀 파일 스키마

**파일:** `data/2022 가계부.xlsx`
**시트명:** `지출내역`
**헤더 행:** 1행 (파싱 시 min_row=2부터 시작)

| 인덱스 | 열 내용 | 타입 | 비고 |
|--------|---------|------|------|
| row[1] | 날짜 | datetime | `.strftime('%Y-%m-%d')` 처리 |
| row[2] | 월 | datetime | `.month` 속성으로 숫자 추출 |
| row[5] | 카테고리 | string | 아래 4개 값 중 하나 |
| row[6] | 상세 내역 | string | 지출 항목명 |
| row[7] | 결제수단 | string | "현금" 또는 "카드" |
| row[8] | 금액 | float | 양수만 유효, 0 이하 제외 |

**카테고리 값 (엑셀 셀 문자열과 완전 일치):**
- `고정비` — 주택 관련 이자, 교육비, 관리비, 자동차 등 고정 지출
- `대출상환` — 주택담보대출 원금 상환
- `변동비` — 식비, 외식비, 의류, 커피 등 생활 소비
- `여행공연비` — 여행, 공연 등 특별 지출

**파싱 예외 처리:** amt가 없거나 0 이하인 행, cat이 없는 행, month가 datetime 타입이 아닌 행은 건너뜀. 예상 외 구조 발생 시 빌드 오류로 즉시 실패 처리 (silent failure 없음).

---

## 기술 스택

| 역할 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript |
| 스타일링 | Tailwind CSS |
| UI 컴포넌트 | shadcn/ui |
| 차트 | Recharts |
| 엑셀 파싱 | xlsx (SheetJS) |
| 배포 | Vercel |

---

## 아키텍처

### 데이터 흐름

```
data/2022 가계부.xlsx
    ↓ (서버 컴포넌트 / 빌드타임)
lib/parseExcel.ts — xlsx 파싱 → 타입화된 JSON
    ↓
app/page.tsx — 서버 컴포넌트에서 파싱 실행
    ↓
클라이언트 컴포넌트에 props로 전달
    ↓
Recharts 차트 렌더링 + 인터랙션
```

- 엑셀 파싱은 서버 컴포넌트(`app/page.tsx`)에서 요청 시 실행 (클라이언트 번들에 xlsx 미포함)
- Vercel에서 Serverless Function으로 동작하며, `data/` 폴더는 Git에 포함되어 런타임 접근 가능
- 별도 API Route 불필요 — 서버 컴포넌트가 직접 파싱 후 클라이언트 컴포넌트에 props 전달
- Vercel 기본 Next.js 빌드 (`next build`)로 배포, `vercel.json` 불필요

---

## 디렉토리 구조

```
/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              ← 서버 컴포넌트, 엑셀 파싱 및 데이터 전달
│   └── globals.css
├── components/
│   ├── KpiCards.tsx          ← 연간 총지출, 월평균, 최대월, 대출비율
│   ├── MonthlyChart.tsx      ← 월별 스택 막대, 드릴다운 트리거
│   ├── DrilldownPanel.tsx    ← 선택 월 요약 + 내역 테이블
│   ├── CategoryChart.tsx     ← 카테고리 도넛 + 필터 연동
│   ├── CategoryTable.tsx     ← 카테고리별 상세 내역 (필터 적용)
│   ├── TrendChart.tsx        ← 월별 생활비 트렌드 라인 (대출 제외)
│   ├── PaymentChart.tsx      ← 결제수단 비율 도넛
│   └── ExpenseTable.tsx      ← 상위 지출 TOP 20
├── lib/
│   ├── parseExcel.ts         ← xlsx 파싱 로직
│   └── types.ts              ← 공유 타입 정의
├── data/
│   └── 2022 가계부.xlsx
├── public/
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 페이지 레이아웃

### 전체 구성 (단일 페이지)

```
[Header]
  - 제목: "2022 가계부 대시보드"
  - 부제: 기간 표시

[KPI 카드 행 - 4개]
  - 연간 총 지출
  - 월 평균 지출
  - 최대 지출 월
  - 대출상환 비율

[섹션 1: 월별 지출 현황]
  - 카테고리별 스택 막대 차트 (12개월)
  - 막대 클릭 시 드릴다운 패널 활성화

[섹션 2: 드릴다운 패널] ← 월 클릭 시만 표시
  - 선택 월 요약 카드 (카테고리별 소계)
  - 해당 월 전체 지출 내역 테이블

[섹션 3: 분석 차트 2열]
  - 좌: 카테고리별 도넛 차트 (클릭 시 우측 필터)
  - 우: 카테고리 상세 내역 테이블 (필터 연동)

[섹션 4: 추가 분석 2열]
  - 좌: 월별 생활비 트렌드 라인 (대출상환 제외)
  - 우: 결제수단 비율 도넛 (현금/카드)

[섹션 5: 상위 지출 내역 TOP 20]
  - 날짜, 분류, 내역, 결제수단, 금액 컬럼
```

---

## 데이터 타입 정의

```typescript
// lib/types.ts

export interface MonthlyData {
  month: string;        // "1월" ~ "12월"
  고정비: number;
  대출상환: number;
  변동비: number;
  여행공연비: number;
  total: number;
}

export interface CategoryTotal {
  고정비: number;
  대출상환: number;
  변동비: number;
  여행공연비: number;
}

export interface ExpenseItem {
  date: string;
  month: number;
  category: string;
  detail: string;
  method: string;
  amount: number;
}

export interface DetailItem {
  name: string;
  amount: number;
}

export interface DashboardData {
  total: number;
  monthlyAvg: number;
  maxMonth: MonthlyData;
  // minMonth는 현재 UI에 미사용, 제거
  categoryTotals: CategoryTotal;
  monthlyList: MonthlyData[];
  paymentMethods: Record<string, number>;
  topExpenses: ExpenseItem[];       // 금액 상위 20건
  variableDetail: DetailItem[];     // 변동비 항목별 소계 (카테고리 테이블에서 변동비 선택 시 표시)
  fixedDetail: DetailItem[];        // 고정비 항목별 소계 (고정비 선택 시 표시)
  // 대출상환/여행공연비 선택 시: allExpenses에서 해당 카테고리로 필터링하여 날짜·내역·금액 테이블로 표시 (DetailItem 별도 없음)
  allExpenses: ExpenseItem[];       // 월별 드릴다운용 전체 내역
}

// 파생값 (컴포넌트에서 계산, 별도 필드 없음):
// - 대출상환 비율: categoryTotals.대출상환 / total
// - 월별 생활비 트렌드: monthlyList[i].total - monthlyList[i].대출상환
```

---

## 인터랙션 설계

### 월별 드릴다운
- 월별 막대 차트에서 특정 월 클릭 → `DrilldownPanel` 표시
- 패널에 선택 월의 카테고리별 소계 + 전체 지출 내역 테이블
- 다시 클릭하거나 닫기 버튼으로 패널 숨김

### 카테고리 필터링
- 도넛 차트에서 카테고리 클릭 → 우측 테이블이 해당 카테고리로 필터
- 전체 보기 버튼으로 필터 해제

---

## 디자인 방향

- 화이트/카드 기반 라이트 테마
- 카테고리 색상:
  - 고정비: `#3B82F6` (파랑)
  - 대출상환: `#EF4444` (빨강)
  - 변동비: `#10B981` (초록)
  - 여행공연비: `#F59E0B` (노랑)
- 헤더: 딥 네이비 그라디언트
- 폰트: Noto Sans KR

---

## Vercel 배포

- `vercel.json` 불필요 (Next.js 자동 감지, 기존 파일 삭제)
- `data/` 폴더를 Git에 포함하여 빌드타임 접근
- 향후 파일 추가 시: `data/` 폴더에 xlsx 추가 → `parseExcel.ts`가 파일명 기반으로 자동 감지 가능한 구조로 설계

---

## 확장 가능성 (현재 범위 외)

- 연도 선택 드롭다운 (다중 파일 지원 시)
- 파일 업로드 UI (동적 데이터 교체)
- 다크 모드
