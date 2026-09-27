# 스냅샷 보고서(HTML) 업로드 — 설계

## 목적

로컬에서 Claude로 생성한 가계 점검 보고서(standalone HTML)를 해당 월 스냅샷에 붙여, 웹에서 바로 열어볼 수 있게 한다.

## 결정 사항

- 업로드: 웹 화면(스냅샷 편집 화면)에서 `.html` 파일 선택
- 개수: 스냅샷당 여러 개 (v1·v2·v3 보관), 개별 삭제
- 저장: DB 테이블 (`snapshot_reports.html` TEXT). 기존 Postgres 백업에 포함, 볼륨 변경 없음
- 보기: 새 탭, 격리된 출처(CSP sandbox)

## 데이터

`docs/sql/2026-09-27-snapshot-reports.sql`

```sql
CREATE TABLE snapshot_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  title       text NOT NULL,
  filename    text NOT NULL,
  html        text NOT NULL,
  size        integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_snapshot_reports_snapshot ON snapshot_reports(snapshot_id, created_at DESC);
```

- `title`: HTML `<title>`에서 추출, 없으면 파일명

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/portfolio/snapshots/[id]/reports` | 목록 (html 제외: id·title·filename·size·created_at) |
| POST | `/api/portfolio/snapshots/[id]/reports` | multipart 업로드. 세션 필수 |
| GET | `/api/portfolio/snapshots/[id]/reports/[rid]` | 원문을 격리 헤더와 함께 text/html로 응답 |
| DELETE | `/api/portfolio/snapshots/[id]/reports/[rid]` | 삭제. 세션 필수 |

업로드 검증: 확장자 `.html`/`.htm`, 5MB 이하, UTF-8 디코드 후 `<html` 또는 `<!doctype html` 포함, 스냅샷 존재.

## 보안

업로드된 HTML은 스크립트를 포함한다. 앱과 같은 출처에서 열면 로그인 세션으로 앱 API를 호출할 수 있으므로 보기 응답에:

- `Content-Security-Policy: sandbox allow-scripts allow-popups` — 고유하지 않은(opaque) 출처로 격리. 스크립트는 동작하나 앱 쿠키·API 접근 불가
- `X-Content-Type-Options: nosniff`
- `Cache-Control: private, no-store`
- 보기도 기존 미들웨어로 로그인 필수

## 화면

- 스냅샷 목록 카드: 보고서가 있으면 "보고서 N" 표시. 누르면 목록 펼침, 항목은 새 탭으로 열기
- 스냅샷 편집 화면: 보고서 섹션 — 업로드 버튼(숨긴 file input), 목록(제목·업로드일·크기), 열기, 삭제
- 디자인 시스템 준수 (`lib/styles.ts` 상수, 테두리 금지, 7단 크기)

## 오류

- 업로드 실패 사유별 한국어 메시지 (확장자·크기·HTML 아님·스냅샷 없음)
- 없는 보고서 404

## 검증

1. `npm run build`
2. 로컬: 업로드 → 목록 → 새 탭 열기 → 삭제
3. 격리 확인: 보고서 내 스크립트에서 `document.cookie` 빈 값, `fetch('/api/...')` 실패
4. 서버 마이그레이션 적용 → 배포 → 9월 스냅샷에 v3 보고서 업로드
