# Finance

개인 가계부 + 포트폴리오 관리 앱.

## 기술 스택

- **프레임워크**: Next.js 14 (App Router), TypeScript, React 18
- **DB**: PostgreSQL 16
- **인증**: NextAuth v5
- **UI**: Tailwind CSS, Recharts
- **가격 데이터**: Yahoo Finance 2 (주식/ETF), CoinGecko (암호화폐)
- **인프라**: Docker Compose, Cloudflare Tunnel

## 주요 기능

### 가계부
- 연간/월별 지출 대시보드
- 카테고리별 지출 분석
- 지출 내역 검색
- Excel 대량 import

### 포트폴리오
- 계좌별 보유 종목 관리 (미국주식, 한국주식, ETF, 코인)
- 실시간 가격 조회 및 자동 수집 (Cron)
- 수익률/손익 계산 (KRW 환산)
- 배당금/분배금 기록
- 포트폴리오 스냅샷 (시점별 자산 현황 기록)
- 목표 비율 설정 및 리밸런싱

## 설치

### 요구사항

- Docker, Docker Compose
- Node.js 20+

### 1. 코드 클론

```bash
git clone https://github.com/lakipiece/finance.git ~/finance
cd ~/finance
```

### 2. 환경변수 설정

```bash
cp .env.example .env
nano .env
```

```env
DB_PASSWORD=강한비밀번호
AUTH_SECRET=     # openssl rand -base64 32
TUNNEL_TOKEN=   # Cloudflare Zero Trust > Tunnels에서 발급
CRON_SECRET=    # openssl rand -hex 32 (가격 수집 cron용, 선택)
```

### 3. DB 실행 및 스키마 생성

```bash
mkdir -p data/postgres
docker compose up db -d
sleep 5

cat docs/schema.sql | docker compose exec -T db psql -U finance finance
cat docs/portfolio-schema.sql | docker compose exec -T db psql -U finance finance
```

### 4. 관리자 계정 생성

```bash
npm install
ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=yourpassword \
  DATABASE_URL=postgresql://finance:YOUR_DB_PASSWORD@localhost:5432/finance \
  npx tsx scripts/setup-auth.ts
```

### 5. 앱 실행

```bash
docker compose up -d --build
```

`http://localhost:3001` 에서 확인.

## 업데이트 배포

```bash
cd ~/finance
git pull
docker compose up -d --build
```

## 가격 자동 수집 (Cron)

보유 종목의 현재가를 Yahoo Finance / CoinGecko에서 가져와 `price_history` 테이블에 기록.

### 설정

1. `.env`에 `CRON_SECRET` 값 설정 후 컨테이너 재시작
2. cron 스크립트 생성:

```bash
cat > ~/scripts/collect-prices.sh << 'SCRIPT'
#!/bin/bash
PORT="${PORT:-3001}"
LOG_FILE="${LOG_FILE:-/home/piece/scripts/collect-prices.log}"

if [ -z "$CRON_SECRET" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: CRON_SECRET 없음" >> "$LOG_FILE"
  exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 가격 수집 시작" >> "$LOG_FILE"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "http://localhost:${PORT}/api/portfolio/prices/refresh" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 90)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] HTTP $HTTP_CODE: $BODY" >> "$LOG_FILE"
SCRIPT
chmod +x ~/scripts/collect-prices.sh
```

3. crontab 등록 (매일 오전 0시 / 오후 12시):

```bash
crontab -e
```

```cron
CRON_SECRET=<생성한 시크릿>
PORT=3001
0 0,12 * * * /bin/bash /home/piece/scripts/collect-prices.sh
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

## Docker 구성

| 서비스 | 이미지 | 포트 | 역할 |
|--------|--------|------|------|
| db | postgres:16-alpine | 5432 | PostgreSQL |
| app | Dockerfile (빌드) | 3001 → 3000 | Next.js 앱 |
| cloudflared | cloudflare/cloudflared | - | `fin.lakipiece.com` 터널 |

## 프로젝트 구조

```
├── app/
│   ├── page.tsx                # 가계부 대시보드
│   ├── portfolio/              # 포트폴리오 페이지
│   ├── search/                 # 지출 검색
│   ├── login/                  # 로그인
│   └── api/                    # API 라우트
│       ├── portfolio/          # 포트폴리오 API
│       └── auth/               # NextAuth
├── lib/
│   ├── portfolio/
│   │   ├── prices.ts           # 가격 수집 (Yahoo/CoinGecko)
│   │   ├── fetch.ts            # DB 쿼리
│   │   └── types.ts            # 타입 정의
│   ├── db.ts                   # PostgreSQL 연결
│   └── auth.ts                 # 인증 설정
├── docs/
│   ├── portfolio-schema.sql    # 포트폴리오 스키마
│   └── schema.sql              # 가계부 기본 스키마
├── scripts/
│   └── setup-auth.ts           # 관리자 계정 생성
├── docker-compose.yml
└── Dockerfile
```
