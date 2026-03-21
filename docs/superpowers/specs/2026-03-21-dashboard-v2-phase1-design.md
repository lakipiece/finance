# 대시보드 v2 — 1단계 기능 추가 설계

**날짜:** 2026-03-21
**범위:** 탭 네비게이션 / 테마 선택기 / 차트 개편 / 검색
**제외 범위 (2단계):** 다중 연도 데이터 업로드, 구글시트 연동, 연도 비교

---

## 구현 방식

**접근법 A — 2단계 분리 구현**의 1단계.
Supabase 스키마 변경 없이 UI/UX를 완성한다.
2단계(다중 연도)는 별도 스펙으로 진행.

---

## 라우팅 & 탭 구조

Next.js App Router 기반 파일 라우팅:

```
app/
  layout.tsx         ← 공통 탭 네비게이션 포함
  page.tsx           → /        개요 탭
  monthly/
    page.tsx         → /monthly  월별분석 탭
  compare/
    page.tsx         → /compare  연도비교 탭 (1단계: "준비 중" 안내)
  search/
    page.tsx         → /search   검색 탭
  palettes/
    page.tsx         → 삭제 (테마 선택기로 통합)
```

**공통 레이아웃 (`app/layout.tsx`):**
- 헤더 내 탭 네비게이션 4개: 개요 / 월별분석 / 연도비교 / 검색
- 현재 경로에 따라 활성 탭 표시 (`usePathname`)
- 헤더 우측에 테마 선택 버튼 배치

**데이터 패턴:**
- `fetchData()`는 서버 컴포넌트에서 호출, 각 탭 페이지에서 import
- 검색 탭은 `allExpenses`를 클라이언트에서 필터링 (서버 재요청 없음)
- `force-dynamic` 유지 — Supabase 최신 데이터 항상 반영

---

## 테마 선택기 (기능 1)

### 동작
- 헤더 우측 팔렛트 아이콘 버튼 클릭 → 드롭다운 패널 오픈
- 패널에 12개 프리셋을 2열 그리드로 표시 (색상 스와치 4개 + 이름)
- 클릭 시 즉시 전체 차트 색상 반영, 패널 닫힘
- 선택값 `localStorage['theme']`에 저장 → 새로고침 유지

### 구현
- 팔렛트 프리셋 목록을 `lib/palettes.ts`에 정의 (id, name, colors[4], headerGradient)
- `ThemeContext` (React Context) — 현재 선택된 팔렛트 전역 공유
- `ThemeProvider`를 `app/layout.tsx`에 배치, localStorage 초기화
- 모든 차트 컴포넌트는 `useTheme()` hook으로 색상 참조
- `lib/utils.ts`의 하드코딩 `CAT_COLORS` 제거 → context로 대체
- `app/palettes/page.tsx` 삭제

---

## 차트 개편 (기능 4)

### 결제수단 차트 제거
- `components/PaymentChart.tsx` 삭제

### 개요 탭 (`/`) 구성
```
[KPI 카드 4개]
[월별 누적 막대 차트]          ← 기존 유지
[분류별 도넛]  [내역 TOP5 바]  ← PaymentChart 자리를 내역 TOP5로 교체
[상위 지출 TOP 20 테이블]       ← 기존 유지
```

**내역 TOP5 바 차트 (`CategoryDetailChart`):**
- 도넛에서 분류 클릭 → 우측에 해당 분류의 내역 금액 상위 5개를 수평 막대로 표시
- 기본값: 전체 합산 기준 상위 내역 5개

### 월별분석 탭 (`/monthly`) 구성
```
[월별 누적 막대 차트] (클릭 → 드릴다운)
[드릴다운 패널] (월 선택 시)
[분류 × 내역 전체 집계 테이블]
  - 분류 탭(고정비/대출상환/변동비/여행공연비) 전환
  - 선택 분류의 내역별 합계를 금액 내림차순 표시
```

**새 컴포넌트:** `CategoryDetailTable` — 분류별 내역 집계 테이블

---

## 검색 탭 (기능 5) — `/search`

### 레이아웃
```
[검색어 입력창]  [분류 필터 ▾]  [월 필터 ▾]

검색 결과 N건

| 날짜 | 분류 | 내역 | 결제수단 | 금액 |
| ...                                    |
```

### 동작
- 검색어: `allExpenses[].detail` 기준 부분 일치, 대소문자 무시
- 분류 드롭다운: 전체 / 고정비 / 대출상환 / 변동비 / 여행공연비
- 월 드롭다운: 전체 / 1월 ~ 12월
- 필터 조합 가능 (AND 조건)
- 실시간 필터링 — 타이핑과 동시에 결과 갱신, 별도 API 호출 없음
- 결과 없으면 "검색 결과가 없습니다" 표시

### 데이터 흐름
- `search/page.tsx` (서버): `fetchData()` 호출 → `allExpenses` 추출
- `SearchClient` (클라이언트): `allExpenses` props 받아 상태 기반 필터링

---

## 컴포넌트 변경 요약

| 상태 | 컴포넌트 | 내용 |
|------|---------|------|
| 신규 | `components/TabNav.tsx` | 헤더 내 탭 네비게이션 |
| 신규 | `components/ThemePicker.tsx` | 헤더 내 팔렛트 드롭다운 |
| 신규 | `components/CategoryDetailChart.tsx` | 내역 TOP5 수평 막대 |
| 신규 | `components/CategoryDetailTable.tsx` | 분류별 내역 집계 테이블 |
| 신규 | `components/SearchClient.tsx` | 검색 UI (클라이언트) |
| 신규 | `lib/palettes.ts` | 12개 팔렛트 프리셋 정의 |
| 신규 | `lib/ThemeContext.tsx` | 테마 Context + Provider + hook |
| 수정 | `app/layout.tsx` | ThemeProvider + 탭 네비 추가 |
| 수정 | `app/page.tsx` | 개요 탭으로 슬림화 |
| 신규 | `app/monthly/page.tsx` | 월별분석 탭 |
| 신규 | `app/compare/page.tsx` | 연도비교 탭 (준비 중) |
| 신규 | `app/search/page.tsx` | 검색 탭 |
| 수정 | 모든 차트 컴포넌트 | `CAT_COLORS` → `useTheme()` |
| 삭제 | `components/PaymentChart.tsx` | 결제수단 차트 제거 |
| 삭제 | `app/palettes/page.tsx` | 테마 선택기로 통합 |

---

## 2단계 예고 (별도 스펙)

- Supabase `expenses` 테이블에 `year` 컬럼 활용 확대
- 엑셀 파일 웹 업로드 UI (`/admin` 또는 데이터관리 탭)
- 구글시트 공유 링크 → 서버사이드 파싱 → Supabase insert
- `/compare` 탭 — 연도 선택 + 나란히 비교 차트
