# Design Bundle — Claude Design 연동용

앱 전체 화면(27개 라우트)과 컴포넌트(73개 tsx)를 전수 조사해 만든 **디자인 시스템 인벤토리**.
각 HTML은 자립형(인라인 CSS)이며 1행에 `<!-- @dsCard group="..." -->` 마커가 있어 Claude Design의
Design System 패널에서 카드로 잡힌다.

## 구성

| 경로 | 그룹 | 내용 |
|---|---|---|
| `audit/summary.html` | Audit | 통합 진단 — 토큰 그룹별 실사용, 결정이 필요한 5가지, 접근성 미달 지점 |
| `foundations/color.html` | Foundations | 브랜드·팔레트·Surface·slate·시맨틱·72색 옵션 컬러 |
| `foundations/typography.html` | Foundations | 크기 12단계 분포, `text.*` / `font.*` 토큰 |
| `foundations/shape-elevation.html` | Foundations | 라운딩 6종·그림자 5종·간격·모션 |
| `components/*.html` | Components | 버튼·배지·카드·폼·테이블·모달·내비게이션·피드백 |
| `dataviz/*.html` | Data Viz | 차트 시리즈 색 / 축·그리드·툴팁 |
| `patterns/kpi-metrics.html` | Patterns | 금액 KPI 표기 방식 비교 |
| `proposals/proposal-{a,b,c}.html` | 시안 (To-be) | 같은 화면을 세 방향으로 렌더링한 비교 시안 |

> 미리보기의 금액·수치는 **실제 잔고가 아닌 샘플값**으로 치환되어 있다.

## 재생성

```bash
node scripts/design-bundle/build-bundle.mjs      # as-is 15장
node scripts/design-bundle/build-proposals.mjs   # 시안 3장
```

## 원본 스크린샷

```bash
node scripts/screenshot-audit.mjs            # 전체 (최초 1회 브라우저 로그인)
node scripts/screenshot-audit.mjs portfolio  # 부분 캡처
```

출력: `screenshots/audit/` — 데스크톱 1440 풀페이지 + 모달 + 모바일 390.
로그인 세션은 `AUTH_STATE` 환경변수 경로에 저장되며 리포에 커밋하지 않는다.

## Claude Design 프로젝트

`Lakipiece Finance — Design System` (projectId `d707efa3-8432-4320-a6c8-69717c352441`)
