# Finance

개인 가계부 + 포트폴리오 관리 앱. Next.js + PostgreSQL + Docker.

## 요구사항

- Docker, Docker Compose
- Node.js 20+
- Git

## 미니PC 초기 설치

### 1. 코드 클론

```bash
git clone https://github.com/lakipiece/finance.git ~/finance
cd ~/finance
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 환경변수 설정

```bash
cp .env.example .env
nano .env
```

`.env` 파일에 아래 값 채우기:

```env
DB_PASSWORD=강한비밀번호
AUTH_SECRET=   # openssl rand -base64 32 결과값
```

### 4. DB 실행 및 스키마 생성

```bash
mkdir -p data/postgres
docker compose up db -d
sleep 5

cat docs/supabase-schema.sql | docker compose exec -T db psql -U finance finance
cat docs/portfolio-schema.sql | docker compose exec -T db psql -U finance finance
```

`role "anon" does not exist` 에러는 무시 (Supabase RLS 정책이라 로컬에선 불필요).

### 5. 관리자 계정 생성

```bash
ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=yourpassword \
  DATABASE_URL=postgresql://finance:YOUR_DB_PASSWORD@localhost:5432/finance \
  npx tsx scripts/setup-auth.ts
```

> DB 포트를 로컬에 노출하려면 `docker compose up db -d` 후 아래로 직접 실행하거나,  
> DB 컨테이너 안에서 실행:
> ```bash
> docker compose exec db psql -U finance finance -c \
>   "INSERT INTO users (email, password_hash) VALUES ('your@email.com', 'bcrypt_hash');"
> ```

### 6. 앱 실행

```bash
docker compose up -d --build
```

`http://localhost:3000` 에서 확인.

---

## 업데이트 배포

```bash
git pull
docker compose up -d --build
```

## 백업

```bash
# 논리 백업
docker compose exec db pg_dump -U finance finance > backup-$(date +%Y%m%d).sql

# 파일 백업 (DB 중지 후)
docker compose stop db
cp -r data/postgres data/postgres-backup-$(date +%Y%m%d)
docker compose start db
```

## Cloudflare Tunnel

`fin.lakipiece.com` → `localhost:3000` 연결.
