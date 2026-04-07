# Design: Supabase + Vercel → Local Docker Migration

**Date**: 2026-04-07  
**Domain**: fin.lakipiece.com  
**Stack**: Next.js + postgres.js + Auth.js + Docker (미니PC)

---

## Architecture

```
[브라우저] → fin.lakipiece.com
    ↓ Cloudflare Tunnel
[미니PC]
  ├── Next.js (Docker, :3000)
  │     ├── Auth.js Credentials — 세션 쿠키 관리
  │     ├── middleware.ts — 인증 게이트
  │     └── API routes — postgres.js 직접 쿼리
  └── PostgreSQL 16 (Docker, :5432)
        └── 볼륨 마운트: ./data/postgres → /var/lib/postgresql/data
```

---

## 변경 파일 목록

| 분류 | 현재 | 변경 후 |
|------|------|---------|
| DB 클라이언트 | `lib/supabase.ts` | `lib/db.ts` (postgres.js) |
| Auth 클라이언트 | `lib/supabase-server.ts`, `lib/supabase-client.ts` | `lib/auth.ts` (Auth.js config) |
| 미들웨어 | Supabase `getUser()` | Auth.js `auth()` |
| 로그인 페이지 | `supabase.auth.signInWithPassword()` | Auth.js `signIn()` |
| API 라우트 20개 | `supabase.from(...)` 쿼리 | `sql\`SELECT ...\`` (postgres.js) |
| 인증 체크 | `supabase.auth.getUser()` | `auth()` session 체크 |
| 신규 추가 | — | `Dockerfile`, `docker-compose.yml`, `app/api/auth/[...nextauth]/route.ts` |
| 패키지 제거 | `@supabase/ssr`, `@supabase/supabase-js` | — |
| 패키지 추가 | — | `postgres`, `next-auth@beta`, `bcryptjs` |

---

## Auth 흐름

1. 로그인: 이메일 + 비밀번호 입력
2. Auth.js Credentials Provider → DB `users` 테이블에서 bcrypt 검증
3. 세션 쿠키 발급 (JWT, httpOnly)
4. 모든 페이지: `middleware.ts`에서 `auth()` 호출 → 세션 없으면 `/login` 리다이렉트
5. API POST/DELETE: route handler 내부에서 `auth()` session 체크

`users` 테이블 신규 생성: `(id, email, password_hash)`

---

## Docker 구성

### docker-compose.yml

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - ./data/postgres:/var/lib/postgresql/data  # 호스트 직접 마운트 → 백업 용이
    environment:
      POSTGRES_DB: ledger
      POSTGRES_USER: ledger
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: unless-stopped

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://ledger:${DB_PASSWORD}@db:5432/ledger
      AUTH_SECRET: ${AUTH_SECRET}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
```

### 볼륨 전략

- `./data/postgres` 경로에 DB 파일 직접 마운트
- 백업: `./data/postgres` 디렉토리를 통째로 복사하거나 rsync
- 또는 `pg_dump`로 논리 백업:
  ```bash
  docker compose exec db pg_dump -U ledger ledger > backup-$(date +%Y%m%d).sql
  ```

### Dockerfile

Next.js standalone 빌드로 이미지 최소화:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## DB 마이그레이션 순서

1. Supabase에서 `pg_dump` 스키마 + 데이터 추출
2. 로컬 PostgreSQL에 복원
3. `users` 테이블 추가 (Auth.js용)
4. Supabase Auth 유저 → users 테이블에 이관 (비밀번호 재설정 or bcrypt 해시 직접 생성)

---

## 환경변수

```env
# .env (docker compose용)
DB_PASSWORD=...
AUTH_SECRET=...  # openssl rand -base64 32

# .env.local (Next.js dev용)
DATABASE_URL=postgresql://ledger:password@localhost:5432/ledger
AUTH_SECRET=...
```

---

## 배포

```bash
# 미니PC에서
git pull
docker compose up -d --build
```

Cloudflare Tunnel → `localhost:3000` → `fin.lakipiece.com`
