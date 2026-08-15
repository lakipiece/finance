# Handoff: Lakipiece Finance — D안 디자인 시스템 적용

## Overview

Lakipiece Finance(개인 자산·가계부 관리 앱)의 디자인 시스템 개편안 **"시안 D"**의 최종 확정 스펙입니다.

D안은 두 가지를 결합합니다:
- **B안의 표면 언어** — 테두리를 전부 걷어내고, 배경 톤 이동 + 넓은 확산 그림자로만 깊이를 만든다
- **C안의 정보 밀도** — 행 높이·카드 패딩·레이블 스케일을 조여 같은 면적에 더 많은 데이터를 담는다

단, **입력 화면은 밀도 압축의 예외 구역**입니다. 입력은 스캔이 아니라 조작이므로 여백을 유지합니다.

작업 범위는 27개 화면 전체이며, 가장 영향이 큰 화면은 **가계부(거래 리스트)** 와 **입금**입니다.

---

## About the Design Files

이 번들의 HTML 파일은 **디자인 레퍼런스**입니다 — 의도한 외형과 동작을 보여주는 프로토타입이지, 그대로 복사해 쓸 프로덕션 코드가 아닙니다.

할 일은 **이 HTML 디자인을 대상 코드베이스의 기존 환경에서 재현**하는 것입니다. 현행 코드베이스는 **Next.js + React + TypeScript + Tailwind CSS** 기반이며, `lib/styles.ts`(토큰 객체)와 `lib/palettes.ts`(카테고리 색)가 존재합니다. 기존 패턴과 라이브러리를 그대로 쓰되, 아래 스펙대로 값을 교체하십시오.

HTML 파일의 CSS를 그대로 옮기지 마십시오. 값(색·크기·간격·굵기)만 가져오고, 구현은 Tailwind 클래스와 기존 토큰 구조를 따르십시오.

---

## Fidelity

**High-fidelity (hifi)** 입니다.

색·타이포·간격·라운딩·그림자가 모두 최종값으로 확정되어 있습니다. 픽셀 단위로 재현하십시오. 아래 "Design Tokens" 섹션의 값이 정본이며, HTML 파일과 값이 어긋나면 **README가 우선**합니다.

---

## 확정된 결정 14건

구현 전에 이 목록을 먼저 읽으십시오. 각 항목은 "왜 이렇게 되었는가"를 담고 있어, 구현 중 판단이 필요할 때 기준이 됩니다.

| # | 결정 | 내용 |
|---|---|---|
| — | **시안** | D안 — B 표면 언어 × C 정보 밀도 |
| D-00 | **표면 램프** | 청색 램프 폐기 → **전면 중성**. `#fafafb → #f1f3f7 → #e9ecf2 → #e0e4ec`. 램프는 한 벌만 존재하며 폼·대시보드 구분 없이 동일 |
| D-01 | **금액 색** | 수입 = **딥 틸 `#00695C`**, 지출 = **무채색 `#0d1c2e`**. 포트폴리오 손익 2색(`#e11d48`/`#2563eb`)은 유지하되 **가계부와 공유하지 않음** |
| D-01a | **카테고리 색** | 수입색과 겹치던 **변동비**를 `#00695C` → **`#26A69A`**로 이동 |
| D-01b | **배지 형식** | 카테고리색을 글자색으로 쓰지 않는다. **점(6px) + 잉크 텍스트 `#3d4a5c`**. (`#26A69A`는 흰 배경 대비 3.0:1로 본문 AA 미달) |
| D-02 | **인풋 전환** | 밑줄형 → **채움형, 27개 화면 일괄**. 과도기 두 벌 상태를 만들지 않는다 |
| D-03 | **입금 인라인 입력** | 표 첫 행이 곧 입력 행. ⏎ 저장 후 커서 유지. **입금 화면 우선**, 모바일(`<640px`)은 모달 폴백 |
| D-04 | **모달 오버레이** | `#0d1c2e/30 + backdrop-blur(6px)`로 통일. `modal.overlay`·`modal.overlayTop`이 이 값을 쓰고 z-index 차이만 유지. blur 미지원 시 `#0d1c2e/42` 폴백 |
| D-05 | **날짜 입력** | `DateInput`·`YearMonthPicker`를 `field.*`에 흡수. **폼 안 = 채움형 필드 / 화면 상단 = 텍스트+셰브론**으로 자리에 따라 구분 |
| D-06 | **모바일 거래 리스트** | **2행 접기** — 분류를 내역 아래로. 행 높이 57px, 리스트 영역 560px 기준 약 9행 |
| D-07 | **키보드** | ⏎ 저장(모달=닫기 / 인라인=계속·커서 복귀) · Esc 취소 · Tab: 금액→분류→내역→날짜→수단→저장 · 1–4 분류 선택 |
| D-07a | **연속 입력** | "저장 후 계속 입력" 토글 상시 노출 + ⌘⏎ 병행. **유일한 신규 기능** — 동작 변경이라 개발 확인 필요 |
| D-08 | **폰트** | **Pretendard 웹폰트로 고정**. mac·Windows·iOS 동일 렌더 (**Android는 지원 대상 아님**) |
| D-08a | **타이포 스케일** | 굵기 **400·500·700** 3단 (600 폐기) · 크기 **7단** (9px 이하 금지) · `-webkit-font-smoothing` **제거** |
| 기타 | **기간 선택기** | 단일 컴포넌트. 배경 없는 텍스트 + 셰브론. 배경 있는 보조 버튼(`#e0e4ec`)은 **실제 액션 전용** |
| 기타 | **차트 막대** | 막대 끝 **라운딩 없음** (`rx` 사용 안 함). 값의 끝과 시각적 끝이 일치해야 함 |

---

## Design Tokens

### 표면 램프 (`surface.*`) — 전면 교체

| 토큰 | 값 | 용도 |
|---|---|---|
| `surface` | `#fafafb` | 앱 배경 · 화면 바닥 · 모달 푸터 |
| `surface-low` | `#f1f3f7` | 인풋 채움 · 구분선 · 사이드바 |
| `surface-container` | `#e9ecf2` | 구분 존 · 차트 그리드 |
| `surface-high` | `#e0e4ec` | 보조 버튼 배경 — **실제 액션 전용** |
| `surface-card` | `#ffffff` | 카드 |

**폐기**: `#f8f9ff` `#eff4ff` `#e6eeff` `#dce9ff` `#ccdbf3` (청색 램프 전체)

### 의미색

| 토큰 | 값 | 용도 | 대비(흰 배경) |
|---|---|---|---|
| `income` | `#00695C` | 수입 · 입금 · 수지 흑자 | 6.6:1 |
| `on-surface` | `#0d1c2e` | 지출 금액 · 기본 텍스트 | 16.3:1 |
| `warning` | `#b45309` | 예산 초과 · 임박 · 이상 거래 | 5.0:1 |
| `action` | `#131b2e` | 주 버튼 · 선택 상태 · 포커스 링 | — |
| `gain` | `#e11d48` | 포트폴리오 상승 **(가계부에 쓰지 않음)** | 4.5:1 |
| `loss` | `#2563eb` | 포트폴리오 하락 **(가계부에 쓰지 않음)** | — |

### 텍스트 색

| 값 | 용도 |
|---|---|
| `#0d1c2e` | 기본 텍스트 · 금액 |
| `#3d4a5c` | 표 내역 · 배지 글자 |
| `#5b6a80` | 폼 라벨 · 보조 설명 |
| `#8794a8` | 캡션 · 날짜 · 부가 정보 |
| `#a8b3c4` | 표 헤더 · 플레이스홀더 · 셰브론 |

**폐기**: `#cbd5e1` (플레이스홀더 — 대비 1.5:1 미달) → `#a8b3c4`로 대체

### 카테고리 팔레트 (`lib/palettes.ts`)

| 인덱스 | 값 | 카테고리 |
|---|---|---|
| `colors[0]` | `#1A237E` | 고정비 |
| `colors[1]` | `#690043` | 대출상환 |
| `colors[2]` | **`#26A69A`** | 변동비 — **이전 `#00695C`에서 변경** |
| `colors[3]` | `#8D6E63` | 여행공연비 |

### 시리즈 색 (포트폴리오 계좌)

`#1A237E` · `#00695C` · `#690043` · `#8D6E63` · `#3949AB` · `#26A69A` · `#a8b3c4`(예수금)

### 타이포그래피

**font-family**
```
'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI',
'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif
```

- 자체 호스팅 권장 (`woff2`) · `font-display: swap` · 한글 서브셋 `unicode-range` 분할
- 로드 굵기 **400 · 500 · 700 세 개만**
- **`-webkit-font-smoothing` 사용 금지** — macOS에서만 획을 가늘게 만들어 플랫폼 차이를 되살림
- 금액·비율·날짜 전부 `font-variant-numeric: tabular-nums`

**굵기 3단**

| 굵기 | 용도 |
|---|---|
| 400 | 본문 · 표 내역 · 값 |
| 500 | 라벨 · 배지 · 표 헤더 · 보조 버튼 · 카드 제목 |
| 700 | 금액 · 페이지/모달 제목 · 주 버튼 · 선택 상태 |

**크기 7단**

| 단계 | 크기/굵기 | 용도 |
|---|---|---|
| display | 22 / 700 / `letter-spacing:-.015em` | KPI 값 (모달 금액 필드는 20px 예외) |
| title | 20 / 700 | 페이지 제목 |
| heading | 15 / 700 | 모달 제목 |
| subhead | 13 / 500 | 카드 제목 · 인풋 입력값 · 모바일 리스트 내역 |
| body | 12 / 400 | 표 본문 · 버튼 · 일반 텍스트 |
| meta | 11 / 500 | 폼 라벨 · 캡션 |
| micro | 10 / 500 / `letter-spacing:.08em` / 대문자 | 표 헤더 · 배지 · 차트 축 |

**9px 이하 금지. 임의 픽셀값 금지.**

**숫자 포맷**

| 위치 | 형식 |
|---|---|
| 표 · 리스트 · 입력 | `6,420,000원` (전체 표기) |
| 차트 축 · 좁은 공간 | `642만` (축약) |
| 비율 | `83.7%` |
| 날짜 | `2026.08.12` |

축약은 **차트 축과 폭이 좁은 곳에만**. 현행은 기준 없이 혼용되고 있었음.

### 라운딩

| 값 | 용도 |
|---|---|
| `9999px` | 배지 · 점 · 게이지 트랙 |
| `18px` | 모달 다이얼로그 · 대시보드 외곽 컨테이너 |
| `16px` | 카드 · KPI 카드 |
| `11px` | 인풋 · 필드 |
| `10px` | 버튼 · 세그먼트 컨트롤 |
| `7px` | 인라인 입력 행 내부 필드 |

### 그림자 — 3종만

| 이름 | 값 | 용도 |
|---|---|---|
| card | `0 4px 32px 0 rgba(13,28,46,.06)` | 카드 전체 |
| dialog | `0 12px 48px -8px rgba(13,28,46,.28)` | 모달 |
| focus | `0 0 0 2px #131b2e` | 인풋 포커스 링 |

**테두리는 사용하지 않습니다.** 유일한 예외는 표의 행 구분선 `1px solid #f1f3f7`인데, 이는 테두리가 아니라 **행 사이 톤 변화**로 취급합니다.

### 간격

| 맥락 | 값 |
|---|---|
| 폼 필드 간격 | `14px` |
| 카드 간 gap | `8px` |
| 카드 내부 패딩 | `13px` (표) / `11px 13px` (KPI) / `14px` (폼) |
| 대시보드 컨테이너 패딩 | `16px` |
| 표 행 패딩 | `5px 0` |
| 모달 헤더/본문/푸터 | `15px 18px` / `0 18px 16px` / `12px 18px` |

---

## Screens / Views

### 1. 포트폴리오 (데스크톱)

**Purpose** — 전체 보유 현황과 수익률을 한눈에 확인

**Layout**
- 최외곽: `background:#fafafb` · `border-radius:18px` · `padding:16px`
- 헤더: 좌측 타이틀 블록 / 우측 액션 (`display:flex; justify-content:space-between; align-items:center; margin-bottom:12px`)
- KPI: `grid-template-columns:repeat(4,1fr)` · `gap:8px` · `margin-bottom:8px`
- 본문: `grid-template-columns:1.15fr 1fr` · `gap:8px`

**Components**

*헤더*
- 타이틀 `포트폴리오` — 20/700 `#0d1c2e`
- 서브 `전체 보유 현황 및 수익률 · 최근 갱신 08-15 09:12` — 12/400 `#5b6a80` · `margin-top:1px`
- 기간 선택기 — **배경 없는 버튼**. 13/700 `#0d1c2e` + 셰브론 `⌄` 11px `#a8b3c4` · `padding:6px 4px` · `gap:5px`
- 주 버튼 `종목 추가` — `background:#131b2e` · 흰 글자 12/700 · `padding:6px 13px` · `radius:9px`

*KPI 카드 4개* — 첫 번째만 다크
- 다크 카드: `background:#131b2e` · `radius:16px` · `padding:11px 13px` · `min-height:66px` · `display:flex; flex-direction:column`
  - 라벨 10/500 대문자 `.08em` `rgba(255,255,255,.72)`
  - 값 22/700 `-.015em` 흰색 우측정렬 `margin-top:auto` `tabular-nums`
  - 보조 10/400 `rgba(255,255,255,.55)` 우측정렬
- 흰 카드: `background:#fff` · card 그림자 · 라벨 `#5b6a80` · 값 `#0d1c2e` · 보조 `#8794a8`
- 3번째(평가손익)만 값·보조가 `#e11d48` (포트폴리오 손익색)

*월별 평가액 차트*
- SVG `viewBox="0 0 400 128"` · `height:128`
- 그리드: `stroke:#e9ecf2` · `stroke-dasharray:3 3` · y = 24/52/80/108
- 막대: 폭 26px · **`rx` 없음** · 원금 `#1A237E` (아래) + 평가익 `#00695C` (위) 스택
- 축 라벨 9px — 값 `#a8b3c4` (우측정렬) / 월 `#8794a8` (가운데정렬)
- 하단 지표 3개: `grid-template-columns:repeat(3,1fr)` · 상단 `border-top:1px solid #f1f3f7` · 라벨 10/500 대문자 `#8794a8` · 값 14/700 `#0d1c2e`

*계좌별 비중 표*
- 헤더 10/500 대문자 `.08em` `#a8b3c4`
- 행 12/400 · `padding:5px 0` · `border-bottom:1px solid #f1f3f7` · 마지막 행 없음
- 계좌명 앞 점 6px 원형 (시리즈 색) · `margin-right:6px`
- 평가액 `#0d1c2e` 우측정렬 / 비중 `#8794a8` / 손익 `#e11d48`·`#2563eb`
- 하단 배지 행: 상단 구분선 + `gap:5px` `flex-wrap`

---

### 2. 가계부 (데스크톱)

**Purpose** — 월 단위 수입·지출 관리. **행 수가 가장 많은 화면으로 D안 밀도의 이득이 가장 큼**

**Layout** — 포트폴리오와 동일 구조 (컨테이너 → 헤더 → KPI 4 → 본문 2열 `1fr 1.25fr`)

**Components**

*KPI 4개* — 이번 달 수입(다크) / 이번 달 지출 / 수지 / 예산 소진
- 수입 카드: 다크, 값 흰색
- 수지 카드: 값·보조 **`#00695C`** (수입색), `+2,234,000원` / `저축률 34.8%`
- 예산 소진: 값 `83.7%` `#0d1c2e` + 게이지
  - 게이지: `height:4px` · `radius:9999px` · 트랙 `#f1f3f7` · 바 `#b45309` · `overflow:hidden` · `margin-top:5px`
  - **링·테두리형 게이지 금지** (테두리 0 원칙)

*분류별 지출 표*
- 열: 분류 / 지출 / 예산 / 소진
- 분류명 앞 점 6px (카테고리 색)
- 소진율: 정상 `#047857`, 임박 `#b45309`, 여유 `#8794a8`
- 하단 100% 스택 바: `height:8px` · `radius:9999px` · `overflow:hidden` · 세그먼트 4개 (카테고리 색)
- 스택 바 아래 범례 10px `#8794a8` `tabular-nums`

*최근 거래 표* — **9행**
- 열: 날짜(46px) / 내역 / 분류 / 금액
- 날짜 `#8794a8` · 내역 `#3d4a5c`
- 분류 = 배지 (점 + 잉크)
- 수입 금액 `#00695C` 700 `+` 부호 / 지출 `#0d1c2e` 400 `−` 부호 / 경고 건 `#b45309` 700
- 예산 초과 건은 내역 옆에 `예산 초과` 경고 배지

---

### 3. 거래 입력 모달

**Purpose** — 지출/수입/이체 1건 입력. **가계부에서 가장 많이 쓰는 인터랙션**

> **중요** — 입력 화면은 **밀도 압축을 적용하지 않습니다**. 필드 간격 14px, 라운딩 11~18px, 11px 국문 라벨. 표·리스트만 조입니다.

**Layout**
- 오버레이: `position:fixed; inset:0` · `background:rgba(13,28,46,.3)` · `backdrop-filter:blur(6px)`
  - `@supports not (backdrop-filter: blur(1px))` → `background:rgba(13,28,46,.42)`
- 다이얼로그: 중앙 · `radius:18px` · dialog 그림자 · `overflow:hidden`
- 헤더 `padding:15px 18px` / 본문 `padding:0 18px 16px; display:grid; gap:14px` / 푸터 `padding:12px 18px; background:#fafafb`

**Components**

*헤더* — 제목 15/700 `#0d1c2e` + 닫기 `×` 16px `#a8b3c4`

*세그먼트 (지출/수입/이체)*
- `display:flex` · 각 `flex:1; text-align:center; padding:8px 0; white-space:nowrap`
- 선택 `background:#131b2e` 흰 글자 12/700
- 미선택 `background:#f1f3f7` `#5b6a80` 12/500
- 양 끝만 라운딩 10px

*금액 필드* — **단독 확대**
- 컨테이너 `background:#f1f3f7` · `radius:11px` · `padding:9px 12px` · `display:flex; align-items:baseline; gap:6px`
- 입력값 20/700 `-.015em` `tabular-nums` **우측정렬**
- 단위 `원` 13/700 `#5b6a80`
- 퀵 칩 `+1천 / +1만 / +10만 / 00 / 지우기` — `padding:5px 10px` · `radius:9999px` · 10/500 · `background:#f1f3f7` (지우기만 `#e0e4ec`) · `margin-top:7px` · `gap:5px`
- 가계부 입력 시간의 대부분이 금액이므로 이 필드가 가장 큼

*날짜 · 결제수단* — 채움형 필드 (`#f1f3f7` · radius 11px · padding 9px 12px · 13/400). 결제수단은 우측에 셰브론

*분류 pill* — **드롭다운 아님. 4개 상시 노출**
- 미선택: `background:#f1f3f7` · 글자 `#3d4a5c` 11/500 · 점 6px (카테고리 색)
- 선택: `background:#131b2e` · 흰 글자 11/700 · **점은 그대로 유지**
- `padding:6px 11px` · `radius:9999px` · `gap:5px` · `display:inline-flex; align-items:center; justify-content:center; line-height:1`

*내역* — 채움형 필드

*연속 입력 토글* — 12/400 `#3d4a5c`
- 트랙 `32×18px` `radius:9999px` `background:#131b2e` (ON) · 노브 `14×14px` 흰색 `right:2px; top:2px`

*푸터*
- 취소 — `background:#e0e4ec` `#3d4a5c` 12/500 · `padding:8px 15px` · `radius:10px`
- 저장 — `background:#131b2e` 흰 글자 12/700 · `padding:8px 17px` · 뒤에 `⏎` `opacity:.6` `font-weight:400`
- 푸터 배경이 `#fafafb`(바닥색)라 **구분선 없이** 액션 영역이 분리됨

**인풋 5상태**

| 상태 | 스펙 |
|---|---|
| 기본 | `background:#f1f3f7` · `radius:11px` · `padding:9px 12px` · 13/400 `#0d1c2e` · `border:0` |
| 포커스 | `background:#fff` · `box-shadow:0 0 0 2px #131b2e` — 배경이 **흰색으로 올라오고** 잉크 링 (표면 레이어링과 같은 논리) |
| 오류 | `background:rgba(225,29,72,.07)` · `box-shadow:0 0 0 1.5px rgba(225,29,72,.35)` · 글자 `#e11d48` · 아래 메시지 10/400 `#e11d48` |
| 비활성 | `background:#fafafb` · 글자 `#a8b3c4` |
| 플레이스홀더 | `#a8b3c4` |

---

### 4. 입금 — 인라인 입력 행

**Purpose** — 정기납입 반복 입력. 모달 왕복 제거 (4계좌 입력 시 클릭 20회 → 8회)

**Layout** — 표 첫 행이 곧 입력 행

- 입력 행 `<tr>`: `background:#f1f3f7` · `<td colspan>` 안에 `padding:6px; border-radius:9px`
- 내부: `display:flex; gap:5px; align-items:center`
- 각 필드 `background:#fff` · `radius:7px` · `padding:6px 8px` · 12/400
  - 날짜 66px 고정 · 계좌 `flex:1` + 셰브론 · 유형 92px + 셰브론
  - 금액 96px · **우측정렬** · 700 · `box-shadow:0 0 0 2px #131b2e` (기본 포커스)
- 추가 버튼: `background:#131b2e` 흰 글자 11/700 · `padding:6px 11px` · `radius:7px` · 라벨 `⏎`
- 아래로 기존 내역 행이 이어짐 (일반 표 스펙)

**Behavior**
- ⏎ → 저장 · 행이 바로 아래 쌓임 · **커서는 금액 칸에 남음** (닫기 개념 없음)
- 입력 중에도 기존 내역이 계속 보여 중복 입금을 즉시 확인 가능
- **`<640px`에서는 인라인 행 대신 모달로 폴백**

---

### 5. 가계부 — 모바일 (2행 접기)

**Purpose** — 360px에서 4열이 들어가지 않는 문제 해결

**Layout** — 행 하나가 2행 구조

```
[내역 (13/400, ellipsis)                    ] [금액 (13, 우측)]
[날짜 (10/500 대문자 #a8b3c4)  분류 배지    ]
```

**Spec**
- 행 `display:flex; align-items:center; gap:9px; padding:8px 0` · `border-bottom:1px solid #f1f3f7` · 마지막 행 없음
- **행 높이 57px** — 터치 타깃 44px 여유 충족. 리스트 영역 560px 기준 약 9행
- 좌측 블록 `flex:1; min-width:0` (ellipsis 동작에 필수)
- 내역 `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`
- 2행 `display:flex; align-items:center; gap:6px; margin-top:3px`
- 금액 `white-space:nowrap` · `tabular-nums` · 수입만 `#00695C` 700
- **분류는 점만 쓰지 않고 라벨을 함께 유지** — 색만으로 의미를 지게 하지 않는 원칙
- 행 전체가 하나의 터치 타깃 (상세·수정 진입)
- 전환점 `<640px`

---

## Interactions & Behavior

### 키보드

| 키 | 동작 | 적용 |
|---|---|---|
| `⏎` | 저장하고 닫기 (토글 ON이면 저장하고 계속) | 모달 |
| `⏎` | 저장하고 계속 — 행 유지 · 커서 복귀 | 인라인 입력 행 |
| `⌘⏎` | 저장하고 계속 입력 (토글 상태와 무관) | 모달 |
| `Esc` | 취소 — 입력값이 있으면 확인 한 번 | 모달 |
| `Tab` | 다음 필드 | 아래 순서 |
| `↑↓` | 드롭다운 항목 이동 | 계좌 · 결제수단 |
| `1`–`4` | 분류 pill 직접 선택 | **금액 필드에 포커스가 없을 때만** (숫자 입력과 충돌 방지) |

**Tab 순서** — 금액 → 분류 → 내역 → 날짜 → 결제수단 → 저장

화면 배치 순서(금액 → 날짜·수단 → 분류 → 내역)와 **의도적으로 다릅니다**. 날짜·결제수단은 기본값이 맞는 경우가 대부분이라 뒤로 미루고, 매번 바뀌는 값을 앞에 둡니다. 분류 pill 그룹은 **탭 스톱 1개**로 묶고 내부는 화살표로 이동합니다.

### 연속 입력 (신규 기능)

현행 코드에 없는 동작입니다. 저장 후 폼 상태를 다루므로 **구현 전 확인이 필요합니다**.

- "저장 후 계속 입력" 토글을 폼에 상시 노출하고 **상태를 기억**(localStorage 등)
- ON일 때 저장 후: 모달 유지 · **금액만 비움** · 커서 금액 칸 복귀 · 나머지 필드는 값 유지
- OFF일 때 저장 후: 모달 닫기
- `⌘⏎`는 토글과 무관하게 항상 "저장하고 계속"
- 모바일은 토글만 (단축키 없음)

### 기본값 · 기억

- 날짜: 오늘
- 결제수단: **마지막 사용 값 기억**
- 분류: 선택 없음 (필수)

### 반응형

| 지점 | 동작 |
|---|---|
| `<640px` | 거래 리스트 → 2행 접기 · 인라인 입력 행 → 모달 폴백 · KPI 4열 → 2열 |
| `≥640px` | 데스크톱 표 구조 |

### 상태

- 오류: 인풋 오류 스타일 + 필드 아래 메시지 10/400 `#e11d48`
- 로딩: 기존 스켈레톤 패턴 유지하되 색을 `#f1f3f7`로 교체
- 빈 상태: 별도 지정 없음 — 기존 패턴 유지

---

## State Management

거래 입력 모달 기준:

| 상태 | 타입 | 비고 |
|---|---|---|
| `type` | `'expense' \| 'income' \| 'transfer'` | 세그먼트 |
| `amount` | `number \| null` | 필수 · 1 이상 |
| `date` | `string` | 기본 오늘 |
| `method` | `string` | **마지막 값 기억** |
| `categoryId` | `string \| null` | 필수 |
| `memo` | `string` | |
| `keepOpen` | `boolean` | **영속 저장** — 연속 입력 토글 |
| `errors` | `Record<field, string>` | |

인라인 입금 행:

| 상태 | 비고 |
|---|---|
| `draft` | 입력 중인 행 |
| `rows` | 저장된 내역 — 저장 시 draft가 rows 맨 앞에 prepend |
| `focusField` | 저장 후 `'amount'`로 복귀 |

**검증** — 금액 ≥ 1, 분류 필수, 날짜 유효성. 저장 버튼은 비활성화하지 말고 **클릭 시 오류를 표시**(비활성 버튼은 이유를 알려주지 못함).

---

## Assets

이 디자인에는 이미지·아이콘 에셋이 없습니다.

- 셰브론은 텍스트 `⌄`, 닫기는 `×`, 더보기는 `⋯`로 표현되어 있습니다 — **실제 구현에서는 코드베이스의 기존 아이콘 세트로 교체**하십시오. 크기는 11~16px, 색은 `#a8b3c4`입니다.
- 폰트 Pretendard는 외부 리소스입니다. [orioncactus/pretendard](https://github.com/orioncactus/pretendard) · OFL 라이선스. **자체 호스팅을 권장**합니다 (검토 중 CDN 경로 하나가 실제로 응답하지 않았습니다).

---

## Files

### 확정 스펙 (정본 — 이것부터 보십시오)

| 파일 | 내용 |
|---|---|
| `spec/color-surface.html` | 표면 램프 · 의미색 · 카테고리 팔레트 · 폐기 목록 |
| `spec/typography.html` | Pretendard · 굵기 3단 · 크기 7단 · 숫자 포맷 |
| `spec/overlays-forms.html` | 채움형 인풋 5상태 · 기간 선택기 2형태 · 모달 · 키보드 |
| `spec/data-display.html` | 배지 3종 · 표 밀도 · 모바일 2행 접기 · 차트 |

### 시안 · 결정 근거

| 파일 | 내용 |
|---|---|
| `proposals/proposal-d.html` | **시안 D 전체** — 포트폴리오 · 가계부 · 입력부 화면 |
| `proposals/decision-board.html` | 확정 14건 목록 |
| `proposals/input-compare.html` | 입력부 4안 비교 |
| `proposals/decision-00-surface-ramp.html` | 표면 램프 3안 |
| `proposals/decision-01-amount-color.html` | 금액 색 5안 |
| `proposals/decision-03-inline-entry.html` | 인라인 입금 3안 |
| `proposals/decision-0405-canonical.html` | 오버레이 · 날짜 입력 |
| `proposals/decision-06-mobile.html` | 모바일 리스트 3안 |
| `proposals/decision-07-keyboard.html` | 키보드 명세 |
| `proposals/decision-08-typography.html` | 폰트 플랫폼 문제 |
| `proposals/decision-08-font-compare.html` | 폰트 3종 실측 비교 |

### 현행 감사 (as-is 기록 — 무엇이 왜 바뀌는지 추적용)

`audit/summary.html` · `foundations/color.html` · `foundations/typography.html` · `foundations/shape-elevation.html` · `components/*.html` · `dataviz/*.html` · `patterns/kpi-metrics.html`

---

## 구현 순서 제안

1. **토큰 교체** — `tailwind.config.ts` 표면 램프 · `lib/styles.ts` 텍스트/의미색 · `lib/palettes.ts` 변동비
2. **폰트** — Pretendard 자체 호스팅 · `-webkit-font-smoothing` 제거 · 굵기 600 → 500/700 일괄 치환
3. **인풋 일괄 전환** — `field.*` 채움형 + `DateInput`·`YearMonthPicker` 흡수 (D-02·D-05는 같은 PR에서)
4. **배지** — 점 + 잉크 텍스트로 변경 (카테고리색을 글자색으로 쓰는 곳 전부)
5. **표 밀도** — 행 패딩·카드 패딩 축소
6. **모달** — 오버레이 통일 · 여백 스펙 적용
7. **모바일 2행 접기**
8. **키보드 + 연속 입력** — 신규 기능이므로 마지막. 별도 확인 필요

1~2번은 전역 교체라 먼저 하면 나머지 작업에서 값이 자동으로 맞습니다.

---

## 주의 사항

- **테두리를 추가하지 마십시오.** 구분이 필요하면 배경 톤을 한 단계 옮기거나 그림자를 쓰십시오. 유일한 예외는 표 행 구분선입니다.
- **가계부에 손익 2색(`#e11d48`/`#2563eb`)을 쓰지 마십시오.** 한 앱 안에서 빨강이 "수익"과 "지출"을 동시에 뜻하게 됩니다.
- **카테고리색을 글자색으로 쓰지 마십시오.** 점으로만 쓰고 글자는 `#3d4a5c` 고정입니다.
- **차트 막대에 `rx`를 넣지 마십시오.**
- **입력 화면에 표 밀도를 적용하지 마십시오.**
- **9px 이하 글자를 쓰지 마십시오.**
- 값이 스펙에 없으면 임의로 만들지 말고 확인을 요청하십시오. 이 시스템의 감사 결론이 "같은 역할에 규칙이 여러 벌"이었고, 개편의 목적이 그것을 한 벌로 줄이는 것입니다.
