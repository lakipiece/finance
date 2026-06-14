# Finance App — CLAUDE.md

개인 재무 관리 앱 (가계부 + 포트폴리오). Next.js 14 App Router + PostgreSQL 16 셀프호스팅.

## 기술 스택

- **Framework**: Next.js 14 App Router (`force-dynamic`)
- **DB**: PostgreSQL 16 (Docker), 클라이언트 `postgres.js`
- **DB 접근**: `getSql()` from `@/lib/db` — template literal SQL
- **인증**: NextAuth v5 (`auth()` from `@/lib/auth`) — write API에 session 체크 필수
- **캐시 무효화**: `invalidateCache()` from `@/lib/cache`
- **스타일**: Tailwind CSS + `lib/styles.ts` 상수 (`btn`, `field`, `modal`, `badge`, `tbl`)
- **차트**: Recharts (BarChart stacked, LineChart, ComposedChart)
- **아이콘**: 인라인 SVG (외부 아이콘 라이브러리 미사용)
- **DnD**: `@dnd-kit/core`, `@dnd-kit/sortable`

## 서버 인프라

miniPC에 Docker Compose로 자체 배포. Vercel/Supabase 미사용.

| 서비스 | 이미지 | 포트 | 역할 |
|--------|--------|------|------|
| `db` | postgres:16-alpine | 5432 | 데이터 저장소 (`./data/postgres` 볼륨) |
| `app` | 로컬 빌드 (Dockerfile) | 3001→3000 | Next.js 앱 |
| `cloudflared` | cloudflare/cloudflared | — | 외부 접속 터널 |

외부 접속 URL: `https://fin.lakipiece.com`

## 서버 작업

### SSH 접속
```bash
ssh ubuntu
# 홈디렉토리: /home/piece
# 앱 디렉토리: ~/finance
```

### 배포 (빌드 포함)
```bash
ssh ubuntu 'cd ~/finance && git pull && docker compose up -d --build'
```

### 서버 로그 확인
```bash
ssh ubuntu 'cd ~/finance && docker compose logs --tail=50 app'
ssh ubuntu 'cd ~/finance && docker compose logs -f app'   # 실시간
```

### DB 마이그레이션 적용
```bash
# 로컬에서 직접 파이프로 전송
ssh ubuntu 'docker exec -i finance-db-1 psql -U finance -d finance' < docs/sql/<migration>.sql

# 서버에서 직접 실행
ssh ubuntu 'docker exec -i finance-db-1 psql -U finance -d finance < ~/finance/docs/sql/<migration>.sql'
```

### DB 접속 (직접 쿼리)
```bash
ssh ubuntu 'docker exec -it finance-db-1 psql -U finance -d finance'
```

## 코딩 패턴

### React
- ternary (`? ... : null`) 사용, `&&` 조건부 렌더링 금지
- 컴포넌트 내부에 컴포넌트 정의 금지 (최상위 함수로)
- 미사용 파라미터: `_item: Type` 접두 언더스코어 컨벤션

### SQL
- `LATERAL JOIN` for 최신값 1건
- `ON CONFLICT ... DO UPDATE` for upsert
- 트랜잭션: `sql.begin(async sql => { ... })`
- RLS 사용 안 함 (일반 PostgreSQL, `anon` role 없음)
- 마이그레이션 파일: `docs/sql/YYYY-MM-DD-<name>.sql`

### 환경 변수 (.env.local)
- `DATABASE_URL` — `postgresql://finance:${DB_PASSWORD}@db:5432/finance`
- `AUTH_SECRET` — NextAuth 시크릿 (32자 이상)
- `NEXTAUTH_URL` — `https://fin.lakipiece.com`
- `DB_PASSWORD` — Postgres 비밀번호
- `TUNNEL_TOKEN` — Cloudflare 터널 토큰
- `GOOGLE_SERVICE_ACCOUNT_JSON` — Google Sheets 서비스 계정 키 경로
