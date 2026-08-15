/**
 * Claude Design 업로드용 디자인 시스템 번들 생성기
 * 출력: docs/design-bundle/**.html  (각 파일 1행에 @dsCard 마커)
 * 실행: node scratchpad/build-bundle.mjs
 */
import fs from 'fs'
import path from 'path'

const OUT = path.resolve('/Users/lakipiece/dev/finance/docs/design-bundle')

// ─── 공통 CSS (모든 카드 자립형) ─────────────────────────────────────────────
const CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:#f8f9ff;color:#0d1c2e;-webkit-font-smoothing:antialiased}
.wrap{padding:28px 32px 40px;max-width:1120px}
h1{font-size:20px;font-weight:700;color:#1A237E;margin:0 0 4px}
.lede{font-size:12px;color:#94a3b8;margin:0 0 24px;line-height:1.6}
h2{font-size:13px;font-weight:600;color:#334155;margin:28px 0 10px;
  padding-bottom:6px;border-bottom:1px solid #f1f5f9}
h2:first-of-type{margin-top:0}
.note{font-size:11px;color:#64748b;margin:0 0 12px;line-height:1.6}
.row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:14px}
.stack{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.spec{display:grid;grid-template-columns:minmax(150px,auto) 1fr;gap:8px 16px;align-items:center;margin-bottom:14px}
.spec .k{font-size:10px;color:#94a3b8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
table.dt{width:100%;border-collapse:collapse;font-size:11px}
table.dt th{text-align:left;padding:6px 10px;color:#94a3b8;font-weight:500;border-bottom:1px solid #f1f5f9}
table.dt td{padding:7px 10px;color:#475569;border-bottom:1px solid #f8fafc;vertical-align:middle}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;
  background:#f1f5f9;color:#475569;padding:1px 5px;border-radius:4px}
.flag{display:inline-block;font-size:9px;font-weight:600;padding:2px 6px;border-radius:9999px;
  background:rgba(244,63,94,.1);color:#e11d48;margin-left:6px;vertical-align:middle}
.flag.dead{background:rgba(100,116,139,.12);color:#64748b}
.flag.ok{background:rgba(16,185,129,.12);color:#047857}
.swatch{width:100%;height:52px;border-radius:10px;border:1px solid rgba(13,28,46,.06)}
.sw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(124px,1fr));gap:12px;margin-bottom:14px}
.sw-name{font-size:10px;font-weight:600;color:#334155;margin-top:6px}
.sw-hex{font-size:9px;color:#94a3b8;font-family:ui-monospace,monospace}
.sw-use{font-size:9px;color:#94a3b8;margin-top:1px;line-height:1.4}
.panel{background:#fff;border-radius:16px;border:1px solid #f1f5f9;box-shadow:0 1px 2px 0 rgb(0 0 0/.05);padding:20px}
.dark-note{font-size:10px;color:#94a3b8;margin-top:4px}
`

const page = (title, group, subtitle, body) => `<!-- @dsCard group="${group}" -->
<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${CSS}</style></head>
<body><div class="wrap"><h1>${title}</h1><p class="lede">${subtitle}</p>
${body}
</div></body></html>
`

const write = (rel, html) => {
  const f = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, html)
  console.log('  ✓', rel)
}

const swatches = (items) => `<div class="sw-grid">${items.map(([hex, name, use]) => `
  <div><div class="swatch" style="background:${hex}"></div>
  <div class="sw-name">${name}</div><div class="sw-hex">${hex}</div>
  <div class="sw-use">${use ?? ''}</div></div>`).join('')}</div>`

// ════════════════════════════════════════════════════════════════════════════
// 1. Foundations — Color
// ════════════════════════════════════════════════════════════════════════════
write('foundations/color.html', page(
  '색상 (as-is)', 'Foundations',
  '현재 코드에 실제로 존재하는 모든 색상 소스. 브랜드·팔레트·Surface·시맨틱이 서로 다른 세 체계로 갈라져 있다.',
  `
<h2>1. 브랜드 (lib/styles.ts › brand)</h2>
${swatches([
  ['#1A237E', 'brand.primary', '페이지 타이틀, 주 버튼, 포커스 링 — 코드 내 81회 하드코딩'],
  ['#00695C', 'brand.accent', '액센트 바, 보조 강조 — 14회 하드코딩'],
])}
<div class="row"><div style="flex:1;height:60px;border-radius:12px;background:linear-gradient(135deg,#1A237E 0%,#00695C 100%)"></div></div>
<p class="note"><code>palette.headerGradient</code> — 헤더/로그인 배경</p>
<div class="row"><div style="flex:1;height:60px;border-radius:12px;background:linear-gradient(135deg,#1A237E 0%,#283593 60%,#00695C 100%)"></div></div>
<p class="note">KPI 강조 카드 그라디언트 — <code>PortfolioKpiCards.tsx</code>에만 인라인 존재 <span class="flag">토큰 없음</span></p>

<h2>2. 카테고리 팔레트 (lib/palettes.ts › DEFAULT_PALETTE)</h2>
<p class="note">가계부 4대 분류에 1:1 고정. 차트 시리즈 색상의 기본 소스이며, 부족하면 <code>+CC</code>/<code>+99</code> 알파를 덧붙여 12색까지 늘려 쓴다.</p>
${swatches([
  ['#1A237E', 'colors[0]', '고정비'],
  ['#690043', 'colors[1]', '대출상환'],
  ['#00695C', 'colors[2]', '변동비'],
  ['#8D6E63', 'colors[3]', '여행공연비'],
])}

<h2>3. Surface 계층 (tailwind.config.ts) <span class="flag dead">코드 사용 0회</span></h2>
<p class="note">"The Orchestrated Lens" 철학용으로 정의됐지만 <b>어느 컴포넌트도 import하지 않는다.</b> 실제 화면은 전부 <code>bg-white</code> + <code>border-slate-100</code>으로 그려져 있다.</p>
${swatches([
  ['#f8f9ff', 'surface', 'Foundation — 앱 배경'],
  ['#eff4ff', 'surface-low', 'Canvas — 사이드바'],
  ['#e6eeff', 'surface-container', 'Container — 구분 존'],
  ['#dce9ff', 'surface-container-high', '보조 버튼 배경'],
  ['#ccdbf3', 'surface-dim', '비활성'],
  ['#ffffff', 'surface-card', 'High-Focus Card'],
  ['#131b2e', 'primary-container', 'CTA 배경'],
  ['#0d1c2e', 'on-surface', '기본 텍스트'],
])}

<h2>4. 실사용 중립 스케일 (Tailwind slate)</h2>
<p class="note">화면의 90%를 차지하는 실질 색상 체계. 표면·테두리·텍스트가 모두 여기서 나온다.</p>
${swatches([
  ['#1e293b', 'slate-800', '금액 강조'],
  ['#334155', 'slate-700', '섹션 제목'],
  ['#475569', 'slate-600', '본문'],
  ['#64748b', 'slate-500', '메타 · 차트 범례'],
  ['#94a3b8', 'slate-400', '레이블 · 차트 축'],
  ['#cbd5e1', 'slate-300', '플레이스홀더 · 비활성 아이콘'],
  ['#e2e8f0', 'slate-200', '인풋 밑줄 · 툴팁 테두리'],
  ['#f1f5f9', 'slate-100', '카드 테두리 · 차트 그리드'],
  ['#f8fafc', 'slate-50', '줄무늬 행 · 호버 배경'],
])}

<h2>5. 시맨틱 — 손익 <span class="flag">3중 정의</span></h2>
<p class="note">한국 관례(상승=빨강 / 하락=파랑)는 일관되지만, <b>같은 의미에 세 벌의 hex가 돌아다닌다.</b></p>
<table class="dt">
<tr><th>의미</th><th>styles.ts</th><th>차트</th><th>IncomeDashboard</th></tr>
<tr><td>상승 / 이익</td>
  <td><span style="color:#f43f5e;font-weight:600">rose-500 #f43f5e</span></td>
  <td><span style="color:#ef4444;font-weight:600">#ef4444</span></td>
  <td><span style="color:#dc2626;font-weight:600">#dc2626</span></td></tr>
<tr><td>하락 / 손실</td>
  <td><span style="color:#3b82f6;font-weight:600">blue-500 #3b82f6</span></td>
  <td><span style="color:#3b82f6;font-weight:600">#3b82f6</span></td>
  <td><span style="color:#2563eb;font-weight:600">#2563eb</span></td></tr>
</table>
<p class="note">그 밖에 <code>rose-400</code>(세금), <code>emerald-500 #10b981</code>(배당), <code>#6B8CAE</code>(드릴다운 폴백)이 개별 파일에 하드코딩되어 있다.</p>

<h2>6. 옵션 컬러 72색 (lib/palettes.ts › OPTION_COLORS)</h2>
<p class="note">사용자가 카테고리·계좌·종목에 직접 지정하는 색. 계열별 정렬. 차트에서 이 색이 팔레트 색과 섞여 나오면서 채도 리듬이 깨진다.</p>
<div style="display:grid;grid-template-columns:repeat(18,1fr);gap:3px;margin-bottom:8px">
${['#1A237E','#00695C','#390069','#690043','#396900','#006769','#0D1B5E','#283593','#1565C0','#01579B','#0277BD','#0288D1','#311B92','#4527A0','#512DA8','#4A148C','#6A1B9A','#7B1FA2','#6D28D9','#880E4F','#AD1457','#C2185B','#D81B60','#E91E8C','#7F1D1D','#B71C1C','#C62828','#D32F2F','#C0392B','#BF360C','#D84315','#E64A19','#E65100','#FF6D00','#F57C00','#FF8F00','#F9A825','#E67E22','#5D4037','#6D4C41','#795548','#8D6E63','#693D00','#7C4A00','#92600A','#C8961A','#33691E','#558B2F','#7C8B12','#827717','#1B5E20','#2E7D32','#388E3C','#2D6A4F','#43A047','#004D40','#00796B','#006064','#1A2940','#37474F','#455A64','#546E7A','#607D8B','#111827','#1F2937','#2D3748','#374151','#3D4558','#424242','#4A5568','#4B5563','#5A6476','#64748B','#718096','#8492A6','#4E342E','#5D4037','#6D4C41']
  .map(c => `<div style="aspect-ratio:1;border-radius:4px;background:${c}"></div>`).join('')}
</div>
`))

// ════════════════════════════════════════════════════════════════════════════
// 2. Foundations — Typography
// ════════════════════════════════════════════════════════════════════════════
write('foundations/typography.html', page(
  '타이포그래피 (as-is)', 'Foundations',
  'Noto Sans KR 단일 폰트. 다만 크기 계단이 12단계로 흩어져 있고, 정의된 토큰(text.*)은 거의 쓰이지 않는다.',
  `
<h2>실사용 크기 분포 — 코드 등장 횟수</h2>
<p class="note">전체 <b>719회</b> 중 <code>text-xs</code>(12px)와 <code>text-[10px]</code>가 73%. 그 사이를 <code>[9px] [11px] [13px]</code>가 임의로 메우고 있다.</p>
<table class="dt">
<tr><th style="width:80px">클래스</th><th style="width:56px">px</th><th style="width:60px">횟수</th><th>샘플</th></tr>
${[
  ['text-5xl','48','1','대시보드 빈 상태 이모지'],
  ['text-2xl','24','4','KPI 값 (sm 이상)'],
  ['text-xl','20','7','페이지 타이틀 · KPI'],
  ['text-lg','18','12','예산 합계 · 스냅샷 금액'],
  ['text-base','16','15','모달 제목'],
  ['text-sm','14','91','섹션 제목 · 본문'],
  ['text-[13px]','13','6','모바일 예산 금액'],
  ['text-xs','12','310','본문 기본 · 버튼 · 테이블'],
  ['text-[11px]','11','56','메타 · 차트 축'],
  ['text-[10px]','10','214','레이블 · 배지 · 캡션'],
  ['text-[9px]','9','2','차트 축 (모바일)'],
  ['text-[7px]','7','1','미니 범례'],
].map(([c,px,n,use]) => `<tr><td><code>${c}</code></td><td>${px}</td><td>${n}</td>
  <td><span style="font-size:${px}px;color:#334155">${use}</span></td></tr>`).join('')}
</table>

<h2>정의된 텍스트 토큰 (lib/styles.ts › text) <span class="flag">import 7회뿐</span></h2>
<div class="stack">
  <div><span style="font-size:20px;font-weight:700;color:#1A237E">text.pageTitle — 포트폴리오</span>
    <div class="dark-note"><code>text-xl font-bold text-[#1A237E]</code></div></div>
  <div><span style="font-size:14px;font-weight:600;color:#334155">text.sectionTitle — 계좌별 현황</span>
    <div class="dark-note"><code>text-sm font-semibold text-slate-700</code></div></div>
  <div><span style="font-size:12px;font-weight:600;color:#475569">text.cardTitle — 월별 지출</span>
    <div class="dark-note"><code>text-xs font-semibold text-slate-600</code></div></div>
  <div><span style="font-size:12px;color:#94a3b8;font-weight:500;text-transform:uppercase;letter-spacing:.05em">text.label — TOTAL VALUE</span>
    <div class="dark-note"><code>text-xs text-slate-400 font-medium uppercase tracking-wider</code></div></div>
  <div><span style="font-size:12px;color:#475569">text.body — 일반 본문 텍스트입니다</span>
    <div class="dark-note"><code>text-xs text-slate-600</code></div></div>
  <div><span style="font-size:10px;color:#94a3b8">text.caption — 2026-08-15 기준</span>
    <div class="dark-note"><code>text-[10px] text-slate-400</code></div></div>
  <div><span style="font-size:12px;color:#cbd5e1">text.muted — 비활성</span>
    <div class="dark-note"><code>text-xs text-slate-300</code></div></div>
  <div><span style="font-size:16px;font-weight:700;color:#1e293b;font-variant-numeric:tabular-nums">text.amount — 128,450,000원</span>
    <div class="dark-note"><code>font-bold tabular-nums text-slate-800</code> · 크기는 호출부가 따로 지정</div></div>
</div>

<h2>미사용 토큰 (lib/styles.ts › font) <span class="flag dead">사용 0회</span></h2>
<div class="stack">
  <div><span style="font-size:44px;font-weight:700;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums">128,450,000</span>
    <div class="dark-note">font.display — <code>text-[2.75rem] font-bold tracking-tight tabular-nums</code></div></div>
  <div><span style="font-size:24px;font-weight:600">font.headline</span>
    <div class="dark-note"><code>text-2xl font-semibold</code></div></div>
  <div><span style="font-size:18px;font-weight:600;color:#1e293b">font.title</span>
    <div class="dark-note"><code>text-lg font-semibold text-slate-800</code></div></div>
</div>
<p class="note">tailwind.config.ts에 <code>fontFamily.manrope</code>가 등록돼 있으나 <code>--font-manrope</code> 변수를 아무도 주입하지 않는다. <span class="flag dead">죽은 토큰</span></p>

<h2>숫자 표기 규칙</h2>
<p class="note">금액·비율은 예외 없이 <code>tabular-nums</code>. 통화는 <code>128,450,000원</code>(전체) / <code>2.6억</code>(축약) 두 포맷터가 공존하며 화면별 선택 기준이 문서화돼 있지 않다.</p>
`))

// ════════════════════════════════════════════════════════════════════════════
// 3. Foundations — Shape & Elevation
// ════════════════════════════════════════════════════════════════════════════
write('foundations/shape-elevation.html', page(
  '형태 · 그림자 · 간격 (as-is)', 'Foundations',
  '라운딩 6단계, 그림자 5단계가 규칙 없이 혼재. 카드 = rounded-2xl 규칙은 문서에만 있고 실제로는 xl/lg도 카드에 쓰인다.',
  `
<h2>라운딩 — 실사용 분포</h2>
<div class="row">
${[['rounded','4px','60회','배지·작은 태그'],['rounded-md','6px','13회','cta 버튼(미사용 토큰)'],
   ['rounded-lg','8px','82회','버튼·인풋·툴팁'],['rounded-xl','12px','57회','서브 영역·드롭존'],
   ['rounded-2xl','16px','76회','카드·모달'],['rounded-full','9999px','101회','pill·아바타·점']]
  .map(([c,px,n,use]) => `<div style="text-align:center">
    <div style="width:92px;height:64px;background:#fff;border:1px solid #e2e8f0;border-radius:${px}"></div>
    <div class="sw-name">${c}</div><div class="sw-hex">${px} · ${n}</div><div class="sw-use">${use}</div></div>`).join('')}
</div>

<h2>그림자 — 실사용 분포</h2>
<div class="row">
${[['shadow-sm','0 1px 2px 0 rgb(0 0 0/.05)','30회','기본 카드'],
   ['shadow','0 1px 3px 0 rgb(0 0 0/.1),0 1px 2px -1px rgb(0 0 0/.1)','11회','—'],
   ['shadow-md','0 4px 6px -1px rgb(0 0 0/.1),0 2px 4px -2px rgb(0 0 0/.1)','4회','KPI 강조 카드'],
   ['shadow-lg','0 10px 15px -3px rgb(0 0 0/.1),0 4px 6px -4px rgb(0 0 0/.1)','15회','툴팁·드롭다운'],
   ['shadow-xl','0 20px 25px -5px rgb(0 0 0/.1),0 8px 10px -6px rgb(0 0 0/.1)','8회','모달']]
  .map(([c,sh,n,use]) => `<div style="text-align:center">
    <div style="width:92px;height:64px;background:#fff;border-radius:16px;box-shadow:${sh}"></div>
    <div class="sw-name">${c}</div><div class="sw-hex">${n}</div><div class="sw-use">${use}</div></div>`).join('')}
</div>
<p class="note">미사용 토큰 <code>surface.cardElevated</code>는 <code>0 4px 32px 0 rgba(13,28,46,.06)</code>라는 <b>여섯 번째</b> 그림자를 또 정의한다. <span class="flag dead">사용 0회</span></p>

<h2>간격 리듬</h2>
<table class="dt">
<tr><th>맥락</th><th>값</th><th>비고</th></tr>
<tr><td>페이지 컨테이너</td><td><code>max-w-7xl mx-auto px-4 py-8 space-y-6</code></td><td>layout.page 토큰 정의됨 <span class="flag dead">사용 0회</span> — 각 페이지가 직접 반복</td></tr>
<tr><td>카드 패딩</td><td><code>p-4 sm:p-6</code> / <code>p-4 sm:p-5</code> / <code>p-3</code></td><td>3종 혼재</td></tr>
<tr><td>카드 그리드 갭</td><td><code>gap-3 sm:gap-4</code> / <code>gap-2</code> / <code>gap-4</code></td><td>3종 혼재</td></tr>
<tr><td>모달 패딩</td><td><code>px-6 py-4</code></td><td>header·body·footer 통일 <span class="flag ok">일관</span></td></tr>
<tr><td>테이블 셀</td><td><code>py-2 px-3</code> (th) / <code>py-2.5 px-3</code> (td)</td><td><span class="flag ok">일관</span></td></tr>
</table>

<h2>모션</h2>
<table class="dt">
<tr><th>토큰</th><th>사용</th></tr>
<tr><td><code>transition-colors</code></td><td>버튼·인풋·행 호버 — 기본값(150ms)</td></tr>
<tr><td><code>transition-opacity</code></td><td>primary 버튼 · 툴팁 페이드</td></tr>
<tr><td><code>transition-all</code> + <code>hover:-translate-y-0.5</code></td><td>KPI·포지션 카드 부상 (9회)</td></tr>
<tr><td><code>hover:scale-110</code></td><td>아이콘 3회 — 다른 카드와 리듬 불일치 <span class="flag">규칙 없음</span></td></tr>
<tr><td><code>animate-pulse</code></td><td>스켈레톤</td></tr>
</table>
<p class="note">duration을 명시한 곳이 없어 전부 Tailwind 기본 150ms. easing 토큰 없음.</p>
`))

// ════════════════════════════════════════════════════════════════════════════
// 4. Components — Buttons
// ════════════════════════════════════════════════════════════════════════════
const B = {
  primary: 'padding:6px 16px;border-radius:8px;font-size:12px;font-weight:500;color:#fff;border:0;background:#1A237E;cursor:pointer;white-space:nowrap',
  secondary: 'padding:6px 16px;border-radius:8px;font-size:12px;font-weight:500;border:1px solid #e2e8f0;color:#475569;background:#fff;cursor:pointer;white-space:nowrap',
  ghost: 'padding:6px 16px;border-radius:8px;font-size:12px;color:#64748b;background:transparent;border:0;cursor:pointer',
  icon: 'padding:6px;border-radius:8px;color:#cbd5e1;background:transparent;border:0;cursor:pointer;line-height:0',
  danger: 'padding:6px;border-radius:8px;color:#cbd5e1;background:transparent;border:0;cursor:pointer;line-height:0',
  pillOn: 'font-size:12px;padding:4px 10px;border-radius:9999px;border:1px solid transparent;background:#1A237E;color:#fff;cursor:pointer',
  pillOff: 'font-size:12px;padding:4px 10px;border-radius:9999px;border:1px solid #e2e8f0;color:#64748b;background:transparent;cursor:pointer',
  ctaPrimary: 'padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;color:#fff;border:0;cursor:pointer;background:linear-gradient(135deg,#131b2e,#7c839b)',
  ctaSecondary: 'padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;color:#131b2e;border:0;cursor:pointer;background:#dce9ff',
}
const svgEdit = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>'
const svgTrash = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>'

write('components/buttons.html', page(
  '버튼 (as-is)', 'Components',
  '두 벌의 버튼 체계가 공존한다 — 실사용 btn.*(라운딩 8px·테마색)와 미사용 cta.*(라운딩 6px·그라디언트). 크기 단계는 없다.',
  `
<h2>btn.* — 실사용 체계 <span class="flag ok">58회 사용</span></h2>
<div class="row">
  <button style="${B.primary}">추가</button>
  <button style="${B.secondary}">취소</button>
  <button style="${B.ghost}">더보기</button>
  <button style="${B.icon}" title="수정">${svgEdit}</button>
  <button style="${B.danger}" title="삭제">${svgTrash}</button>
  <button style="${B.pillOn}">전체</button>
  <button style="${B.pillOff}">고정비</button>
</div>
<table class="dt">
<tr><th style="width:110px">토큰</th><th>스펙</th><th style="width:190px">비고</th></tr>
<tr><td><code>btn.primary</code></td><td><code>px-4 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90</code></td><td>배경색을 <b>style prop으로 따로</b> 넘겨야 동작 <span class="flag">암묵 계약</span></td></tr>
<tr><td><code>btn.secondary</code></td><td><code>border border-slate-200 text-slate-600 hover:bg-slate-50</code></td><td>—</td></tr>
<tr><td><code>btn.ghost</code></td><td><code>text-slate-500 hover:bg-slate-100</code></td><td>—</td></tr>
<tr><td><code>btn.icon</code></td><td><code>p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100</code></td><td>기본 상태 대비 1.5:1 <span class="flag">가독성</span></td></tr>
<tr><td><code>btn.danger</code></td><td><code>p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-50</code></td><td>호버 전엔 일반 아이콘과 구분 불가</td></tr>
<tr><td><code>btn.pill(active)</code></td><td><code>text-xs px-2.5 py-1 rounded-full border</code></td><td>active 색도 style prop 별도 주입</td></tr>
</table>

<h2>cta.* — 정의만 된 체계 <span class="flag dead">사용 0회</span></h2>
<div class="row">
  <button style="${B.ctaPrimary}">저장하기</button>
  <button style="${B.ctaSecondary}">되돌리기</button>
</div>
<p class="note">라운딩 <code>rounded-md</code>(6px), 패딩 <code>py-2</code>, 굵기 <code>font-semibold</code> — btn.*과 <b>세 값 모두 다르다</b>. 통합 시 어느 쪽을 정본으로 삼을지가 첫 번째 결정 사항.</p>

<h2>비어 있는 축</h2>
<table class="dt">
<tr><th style="width:140px">축</th><th>현황</th></tr>
<tr><td>크기 단계</td><td>sm / md / lg 없음. 모든 버튼이 <code>text-xs</code> 단일 크기 <span class="flag">미정의</span></td></tr>
<tr><td>disabled</td><td><code>btn.secondary</code>·<code>cta.*</code>에만 <code>disabled:opacity-50</code>. primary·ghost·icon엔 없음</td></tr>
<tr><td>loading</td><td>스피너·비활성 처리 패턴 없음 — 각 화면이 텍스트를 "저장 중..."으로 바꾸는 식으로 개별 처리</td></tr>
<tr><td>focus-visible</td><td><b>전 버튼 미정의</b> — 키보드 포커스 링이 브라우저 기본에 의존 <span class="flag">접근성</span></td></tr>
<tr><td>destructive 텍스트 버튼</td><td>없음 — 삭제 확정 버튼이 화면마다 다른 색으로 인라인 작성</td></tr>
</table>
`))

// ════════════════════════════════════════════════════════════════════════════
// 5. Components — Badges
// ════════════════════════════════════════════════════════════════════════════
write('components/badges.html', page(
  '배지 (as-is)', 'Components',
  'solid 배지(badge.*)와 10% 투명 배지(statusBadge.*) 두 체계. 후자는 정의만 되고 쓰이지 않는다.',
  `
<h2>badge.* — 실사용 <span class="flag ok">9회</span></h2>
<div class="row">
  <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:500;background:#f1f5f9;color:#334155">고정비</span>
  <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;background:#f1f5f9;color:#64748b">3개 계좌</span>
  <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;font-family:ui-monospace,monospace;background:rgba(26,35,126,.12);color:#1A237E">AAPL</span>
  <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:#eff6ff;color:#2563eb">Laki</span>
  <span style="display:inline-block;padding:2px 6px;border-radius:9999px;font-size:10px;font-weight:500;background:#eff6ff;color:#3b82f6">최신</span>
  <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;background:#dcfce7;color:#15803d">Sheets</span>
  <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;background:#dbeafe;color:#1d4ed8">Excel</span>
  <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;background:#f1f5f9;color:#64748b">미분류</span>
</div>
<table class="dt">
<tr><th style="width:110px">토큰</th><th>스펙</th><th style="width:150px">라운딩</th></tr>
<tr><td><code>badge.base</code></td><td><code>px-2 py-0.5 text-xs font-medium</code> + 색은 호출부 지정</td><td>full</td></tr>
<tr><td><code>badge.sm</code></td><td><code>px-1.5 py-0.5 text-[10px] font-medium</code></td><td>4px <span class="flag">base와 불일치</span></td></tr>
<tr><td><code>badge.ticker</code></td><td><code>text-[10px] font-bold font-mono</code></td><td>4px</td></tr>
<tr><td><code>badge.owner</code></td><td>blue-50 / blue-600 고정</td><td>4px</td></tr>
<tr><td><code>badge.latest</code></td><td>blue-50 / blue-500 고정</td><td>full <span class="flag">owner와 불일치</span></td></tr>
<tr><td><code>badge.success / info / neutral</code></td><td>green-100·blue-100·slate-100</td><td>4px</td></tr>
</table>

<h2>statusBadge.* — 정의만 <span class="flag dead">사용 0회</span></h2>
<div class="row">
  <span style="padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:500;background:rgba(16,185,129,.1);color:#047857">성공</span>
  <span style="padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:500;background:rgba(245,158,11,.1);color:#b45309">주의</span>
  <span style="padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:500;background:rgba(244,63,94,.1);color:#e11d48">위험</span>
  <span style="padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:500;background:rgba(14,165,233,.1);color:#0369a1">정보</span>
  <span style="padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:500;background:rgba(100,116,139,.1);color:#475569">중립</span>
</div>
<p class="note">문서에는 "solid pill 금지, 상태색 10% + 고대비 텍스트"라고 적혀 있지만 실제 화면은 전부 solid <code>badge.*</code>다. <b>문서와 코드가 정반대.</b></p>

<h2>배지가 아닌데 배지처럼 쓰이는 것들</h2>
<div class="row">
  <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#334155"><span style="width:7px;height:7px;border-radius:9999px;background:#1A237E"></span>Laki-ISA</span>
  <span style="font-size:11px;font-weight:600;color:#f43f5e;font-variant-numeric:tabular-nums">+16,150,000원</span>
  <span style="font-size:10px;color:#94a3b8;font-variant-numeric:tabular-nums">10.9%</span>
</div>
<p class="note">계좌 색상 점 · 손익 텍스트 · 비중 텍스트가 배지와 같은 시각 무게로 한 줄에 섞여 나온다. 위계 정의 필요.</p>
`))

// ════════════════════════════════════════════════════════════════════════════
// 6. Components — Cards
// ════════════════════════════════════════════════════════════════════════════
write('components/cards.html', page(
  '카드 · 표면 (as-is)', 'Components',
  '실사용 카드는 "흰 배경 + 1px slate-100 테두리 + shadow-sm". 문서가 금지한 방식이며, 대체안으로 정의된 surface.*는 쓰이지 않는다.',
  `
<h2>card.* — 실사용 <span class="flag ok">13회</span></h2>
<div class="row" style="align-items:stretch">
  <div style="flex:1;min-width:200px;background:#fff;border-radius:16px;border:1px solid #f1f5f9;box-shadow:0 1px 2px 0 rgb(0 0 0/.05);padding:20px">
    <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px">card.base</div>
    <div style="font-size:11px;color:#94a3b8;line-height:1.6">페이지 주요 섹션.<br><code>bg-white rounded-2xl shadow-sm border-slate-100</code></div>
  </div>
  <div style="flex:1;min-width:200px;background:#fff;border-radius:16px;border:1px solid #f1f5f9;padding:20px">
    <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px">card.inner</div>
    <div style="font-size:11px;color:#94a3b8;line-height:1.6">카드 안의 카드. 그림자 없음.</div>
  </div>
  <div style="flex:1;min-width:200px;background:#fff;border-radius:16px;border:1px solid #f1f5f9;padding:20px;transform:translateY(-2px);box-shadow:0 4px 6px -1px rgb(0 0 0/.06)">
    <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px">card.interactive <span style="font-weight:400;color:#94a3b8">(hover)</span></div>
    <div style="font-size:11px;color:#94a3b8;line-height:1.6"><code>hover:-translate-y-0.5</code> — 그림자 변화는 없어 부상감이 약하다</div>
  </div>
  <div style="flex:1;min-width:200px;background:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;padding:20px">
    <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px">card.sub</div>
    <div style="font-size:11px;color:#94a3b8;line-height:1.6">카드 내 구분 영역. <b>라운딩만 12px</b> <span class="flag">불일치</span></div>
  </div>
</div>

<h2>surface.* — 정의만 <span class="flag dead">사용 0회</span></h2>
<div style="background:#f8f9ff;padding:20px;border-radius:16px">
  <div style="background:#eff4ff;padding:18px;border-radius:16px">
    <div style="background:#fff;border-radius:16px;box-shadow:0 4px 32px 0 rgba(13,28,46,.06);padding:18px">
      <div style="font-size:12px;font-weight:600;color:#475569">surface.cardElevated</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px;line-height:1.6">Foundation #f8f9ff → Canvas #eff4ff → Card #fff.<br>테두리 없이 배경 대비만으로 깊이를 만드는 방식.</div>
    </div>
  </div>
</div>
<p class="note" style="margin-top:12px"><b>핵심 갈림길:</b> 테두리 기반(현행 card.*) vs 배경 레이어 기반(설계된 surface.*) 중 하나를 정본으로 골라야 한다. 지금은 두 규칙이 문서·코드에 동시에 살아 있다.</p>

<h2>실제 화면의 카드 변종</h2>
<div class="row" style="align-items:stretch">
  <div style="width:210px;border-radius:16px;box-shadow:0 4px 6px -1px rgb(0 0 0/.1),0 2px 4px -2px rgb(0 0 0/.1);padding:18px;position:relative;overflow:hidden;background:linear-gradient(135deg,#1A237E 0%,#283593 60%,#00695C 100%);display:flex;flex-direction:column;height:104px">
    <div style="font-size:10px;color:#bfdbfe;font-weight:600;text-transform:uppercase;letter-spacing:.1em">총 평가금액</div>
    <div style="margin-top:auto;text-align:right;font-size:20px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums">128,450,000원</div>
    <div style="position:absolute;right:-16px;bottom:-16px;width:80px;height:80px;border-radius:9999px;background:#fff;opacity:.1"></div>
  </div>
  <div style="width:210px;background:#fff;border-radius:16px;border:1px solid #f1f5f9;box-shadow:0 1px 2px 0 rgb(0 0 0/.05);padding:18px;display:flex;flex-direction:column;height:104px">
    <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">평가손익</div>
    <div style="margin-top:auto;text-align:right;font-size:18px;font-weight:700;color:#f43f5e;font-variant-numeric:tabular-nums">+16,150,000원</div>
  </div>
  <div style="width:210px;background:#fff;border-radius:12px;border:1px solid #f1f5f9;padding:12px;display:flex;flex-direction:column;height:104px">
    <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#334155"><span style="width:7px;height:7px;border-radius:9999px;background:#1A237E"></span>Laki-ISA</div>
    <div style="margin-top:auto;text-align:right"><div style="font-size:13px;font-weight:700;color:#1e293b;font-variant-numeric:tabular-nums">24,180,000원</div>
    <div style="font-size:10px;color:#f43f5e;font-variant-numeric:tabular-nums">+1,940,000원</div></div>
    <div style="display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;margin-top:4px"><span>10.9%</span><span style="color:#f43f5e">+8.5%</span></div>
  </div>
</div>
<p class="note">KPI 강조 · KPI 일반 · 계좌 타일 — 라운딩(16/16/12), 그림자(md/sm/none), 레이블 트래킹(0.1em/0.05em/없음)이 전부 다르다. 한 화면에 나란히 놓인다.</p>
`))

// ════════════════════════════════════════════════════════════════════════════
// 7. Components — Forms
// ════════════════════════════════════════════════════════════════════════════
write('components/forms.html', page(
  '폼 (as-is)', 'Components',
  '가장 잘 지켜지는 영역(field.* 155회). 밑줄형 인풋이 기본이고 검색·텍스트에어리어만 박스형이다.',
  `
<h2>field.* — 실사용 <span class="flag ok">155회, 앱 내 최다</span></h2>
<div class="panel">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px 24px;max-width:640px">
    <div>
      <label style="display:block;font-size:10px;color:#94a3b8;margin-bottom:4px">계좌명</label>
      <input value="Laki-ISA" style="width:100%;border:0;border-bottom:1px solid #e2e8f0;background:transparent;padding:4px 0 6px;font-size:12px;color:#475569;outline:none">
      <div class="dark-note"><code>field.input</code></div>
    </div>
    <div>
      <label style="display:block;font-size:10px;color:#94a3b8;margin-bottom:4px">구분</label>
      <select style="border:0;border-bottom:1px solid #e2e8f0;background:transparent;padding:4px 0 6px;font-size:12px;color:#475569;outline:none;appearance:none;width:100%"><option>증권</option></select>
      <div class="dark-note"><code>field.select</code></div>
    </div>
    <div>
      <label style="display:block;font-size:10px;color:#94a3b8;margin-bottom:4px">포커스 상태</label>
      <input value="입력 중" style="width:100%;border:0;border-bottom:1px solid #1A237E;background:transparent;padding:4px 0 6px;font-size:12px;color:#475569;outline:none">
      <div class="dark-note">밑줄만 브랜드색으로 — 링 없음</div>
    </div>
    <div>
      <label style="display:block;font-size:10px;color:#94a3b8;margin-bottom:4px">플레이스홀더</label>
      <input placeholder="종목명을 입력하세요" style="width:100%;border:0;border-bottom:1px solid #e2e8f0;background:transparent;padding:4px 0 6px;font-size:12px;color:#475569;outline:none">
      <div class="dark-note">placeholder <code>slate-300</code> — 대비 1.5:1 <span class="flag">접근성</span></div>
    </div>
    <div style="grid-column:1/-1">
      <label style="display:block;font-size:10px;color:#94a3b8;margin-bottom:4px">검색 (박스형)</label>
      <div style="position:relative"><span style="position:absolute;left:9px;top:6px;color:#cbd5e1">
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
      <input placeholder="종목명/티커 검색" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px 6px 28px;font-size:12px;color:#64748b;outline:none;background:#fff"></div>
      <div class="dark-note"><code>field.search</code> — 유일하게 <code>focus:ring</code>을 쓰는 인풋 <span class="flag">포커스 규칙 불일치</span></div>
    </div>
    <div style="grid-column:1/-1">
      <label style="display:block;font-size:10px;color:#94a3b8;margin-bottom:4px">메모</label>
      <textarea rows="2" style="width:100%;border:1px solid #f1f5f9;border-radius:8px;padding:8px 12px;font-size:12px;color:#475569;outline:none;resize:none;font-family:inherit">여러 줄 입력</textarea>
      <div class="dark-note"><code>field.textarea</code> — 테두리가 <code>slate-100</code>, 검색은 <code>slate-200</code> <span class="flag">불일치</span></div>
    </div>
    <div style="grid-column:1/-1">
      <div style="border:2px dashed #e2e8f0;border-radius:12px;padding:24px;text-align:center;font-size:11px;color:#94a3b8">엑셀 파일을 끌어다 놓으세요</div>
      <div class="dark-note"><code>field.dropzone</code></div>
    </div>
  </div>
</div>

<h2>비어 있는 축</h2>
<table class="dt">
<tr><th style="width:150px">축</th><th>현황</th></tr>
<tr><td>에러 상태</td><td><b>정의 없음</b> — 유효성 실패 시 색·메시지 규칙이 없어 화면마다 alert()나 인라인 텍스트로 제각각 <span class="flag">미정의</span></td></tr>
<tr><td>필수 표시</td><td>없음</td></tr>
<tr><td>도움말 텍스트</td><td>없음 — <code>field.label</code>과 <code>field.labelSm</code>이 색만 다르게 두 벌 존재</td></tr>
<tr><td>체크박스 · 라디오 · 토글</td><td>토큰 없음. 각 화면에서 인라인 작성</td></tr>
<tr><td>날짜 입력</td><td><code>ui/DateInput.tsx</code>, <code>ui/YearMonthPicker.tsx</code>가 별도 존재하나 field.*를 쓰지 않음</td></tr>
</table>
`))

// ════════════════════════════════════════════════════════════════════════════
// 8. Components — Tables
// ════════════════════════════════════════════════════════════════════════════
write('components/tables.html', page(
  '테이블 (as-is)', 'Components',
  'tbl.* 35회 사용으로 비교적 일관. 다만 줄무늬 + 호버가 같은 색 계열이라 호버 피드백이 약하다.',
  `
<h2>tbl.* 기본형</h2>
<div class="panel" style="padding:8px 4px">
<table style="width:100%;border-collapse:collapse">
<thead><tr>
  <th style="text-align:left;padding:8px 12px;font-size:12px;color:#94a3b8;font-weight:500">날짜</th>
  <th style="text-align:left;padding:8px 12px;font-size:12px;color:#94a3b8;font-weight:500">종목</th>
  <th style="text-align:left;padding:8px 12px;font-size:12px;color:#94a3b8;font-weight:500">계좌</th>
  <th style="text-align:right;padding:8px 12px;font-size:12px;color:#94a3b8;font-weight:500">수량</th>
  <th style="text-align:right;padding:8px 12px;font-size:12px;color:#94a3b8;font-weight:500">평가금액</th>
  <th style="text-align:right;padding:8px 12px;font-size:12px;color:#94a3b8;font-weight:500">손익</th>
</tr></thead>
<tbody>
${[['2026-08-14','KODEX 미국S&P500','Laki-ISA','120','12,480,000원','+1,120,000원',1],
   ['2026-08-13','TIGER 미국S&P500','Piece-IRP','86','9,260,000원','+840,000원',0],
   ['2026-08-12','ACE 미국배당다우존스','Laki-연금저축','240','7,140,000원','+1,530,000원',1],
   ['2026-08-11','삼성전자','Laki-KB예금','30','3,120,000원','−262,000원',0]]
  .map(([d,n,a,q,v,p,even]) => `<tr style="border-bottom:1px solid #f8fafc;${even?'background:rgba(248,250,252,.4)':''}">
  <td style="padding:10px 12px;font-size:12px;color:#475569">${d}</td>
  <td style="padding:10px 12px;font-size:12px;color:#475569">${n}</td>
  <td style="padding:10px 12px;font-size:12px;color:#475569">${a}</td>
  <td style="padding:10px 12px;font-size:12px;color:#475569;text-align:right;font-variant-numeric:tabular-nums">${q}</td>
  <td style="padding:10px 12px;font-size:12px;color:#475569;text-align:right;font-variant-numeric:tabular-nums">${v}</td>
  <td style="padding:10px 12px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;color:${p.startsWith('+')?'#f43f5e':'#3b82f6'}">${p}</td></tr>`).join('')}
<tr style="border-bottom:1px solid #f8fafc;background:#f8fafc">
  <td style="padding:10px 12px;font-size:12px;color:#475569">2026-08-10</td>
  <td style="padding:10px 12px;font-size:12px;color:#475569">엔비디아 <span style="font-size:10px;color:#cbd5e1">← hover 상태</span></td>
  <td style="padding:10px 12px;font-size:12px;color:#475569">Laki-ISA</td>
  <td style="padding:10px 12px;font-size:12px;color:#475569;text-align:right;font-variant-numeric:tabular-nums">12</td>
  <td style="padding:10px 12px;font-size:12px;color:#475569;text-align:right;font-variant-numeric:tabular-nums">4,380,000원</td>
  <td style="padding:10px 12px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;color:#f43f5e">+416,000원</td></tr>
</tbody></table>
</div>
<table class="dt" style="margin-top:16px">
<tr><th style="width:110px">토큰</th><th>스펙</th></tr>
<tr><td><code>tbl.th / thRight</code></td><td><code>py-2 px-3 text-xs text-slate-400 font-medium</code></td></tr>
<tr><td><code>tbl.td / tdRight</code></td><td><code>py-2.5 px-3 text-xs text-slate-600</code> (+ <code>tabular-nums</code>)</td></tr>
<tr><td><code>tbl.rowEven</code></td><td><code>border-b border-slate-50 hover:bg-slate-50</code></td></tr>
<tr><td><code>tbl.rowOdd</code></td><td>위 + <code>bg-slate-50/40</code></td></tr>
</table>
<p class="note">홀수행 배경 <code>slate-50/40</code>와 호버 배경 <code>slate-50</code>의 차이가 40% 알파뿐이라 <b>홀수행에 마우스를 올려도 거의 변화가 없다.</b></p>

<h2>비어 있는 축</h2>
<table class="dt">
<tr><th style="width:150px">축</th><th>현황</th></tr>
<tr><td>정렬 헤더</td><td>토큰 없음 — 정렬 가능 여부·방향 아이콘이 화면마다 다르게 구현</td></tr>
<tr><td>고정 헤더</td><td>일부 화면만 <code>sticky top-0</code> 인라인</td></tr>
<tr><td>합계 행</td><td>토큰 없음 — 굵기·배경이 화면마다 다름</td></tr>
<tr><td>빈 상태</td><td>이모지 + <code>text-xl</code> 문구(연도비교) vs 회색 한 줄 — 통일 안 됨</td></tr>
<tr><td>모바일 전환</td><td>테이블 → 카드 전환 규칙 없음. 가로 스크롤로 방치되는 화면 존재</td></tr>
</table>
`))

// ════════════════════════════════════════════════════════════════════════════
// 9. Components — Modals
// ════════════════════════════════════════════════════════════════════════════
write('components/modals.html', page(
  '모달 (as-is)', 'Components',
  'modal.* 45회 사용으로 구조는 일관(header/body/footer). 다만 overlay가 두 벌, 배경 규칙도 두 벌이다.',
  `
<h2>modal.* 기본형</h2>
<div style="position:relative;height:340px;border-radius:16px;overflow:hidden;background:#f1f5f9">
  <div style="position:absolute;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">
    <div style="background:#fff;border-radius:16px;box-shadow:0 20px 25px -5px rgb(0 0 0/.1),0 8px 10px -6px rgb(0 0 0/.1);width:400px;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid #f1f5f9">
        <span style="font-size:14px;font-weight:600;color:#334155">계좌 수정</span>
        <button style="border:0;background:transparent;color:#94a3b8;padding:4px;border-radius:4px;cursor:pointer;line-height:0">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div style="padding:16px 24px;display:flex;flex-direction:column;gap:16px">
        <div><label style="display:block;font-size:10px;color:#94a3b8;margin-bottom:4px">계좌명</label>
          <input value="Laki-ISA" style="width:100%;border:0;border-bottom:1px solid #e2e8f0;background:transparent;padding:4px 0 6px;font-size:12px;color:#475569;outline:none"></div>
        <div><label style="display:block;font-size:10px;color:#94a3b8;margin-bottom:4px">색상</label>
          <div style="display:flex;gap:6px">${['#1A237E','#690043','#00695C','#8D6E63','#4527A0'].map((c,i)=>`<div style="width:22px;height:22px;border-radius:9999px;background:${c};${i===0?'outline:2px solid #1A237E;outline-offset:2px':''}"></div>`).join('')}</div></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid #f1f5f9">
        <button style="${B.secondary}">취소</button>
        <button style="${B.primary}">저장</button>
      </div>
    </div>
  </div>
</div>
<table class="dt" style="margin-top:16px">
<tr><th style="width:130px">토큰</th><th>스펙</th></tr>
<tr><td><code>modal.overlay</code></td><td><code>fixed inset-0 z-50 bg-black/40 px-4</code></td></tr>
<tr><td><code>modal.overlayTop</code></td><td><code>z-[9999]</code> — 모달 위 모달(createPortal)</td></tr>
<tr><td><code>modal.container / containerLg</code></td><td><code>rounded-2xl shadow-xl max-w-md / max-w-lg</code>, <code>max-h-[95dvh] sm:max-h-[90vh]</code></td></tr>
<tr><td><code>modal.header / body / footer</code></td><td><code>px-6 py-4</code> + <code>border-slate-100</code> 구분선</td></tr>
<tr><td><code>glass.overlay</code> <span class="flag dead">사용 0회</span></td><td><code>bg-[#0d1c2e]/30 backdrop-blur-[6px]</code> — 전혀 다른 오버레이 규칙</td></tr>
</table>
<p class="note">모달 제목의 크기·굵기가 토큰화돼 있지 않아 화면마다 <code>text-sm</code> / <code>text-base</code> / <code>font-semibold</code> / <code>font-bold</code>가 섞인다.</p>

<h2>비어 있는 축</h2>
<table class="dt">
<tr><th style="width:150px">축</th><th>현황</th></tr>
<tr><td>확인 다이얼로그</td><td>전용 컴포넌트 없음 — 삭제 확인이 브라우저 <code>confirm()</code> 또는 개별 모달로 갈림</td></tr>
<tr><td>토스트 · 알림</td><td><b>없음</b>. 성공/실패 피드백이 <code>alert()</code>와 인라인 텍스트로 이원화 <span class="flag">미정의</span></td></tr>
<tr><td>진입 · 퇴장 모션</td><td>없음 — 즉시 나타나고 즉시 사라짐</td></tr>
<tr><td>포커스 트랩 · aria</td><td><code>role="dialog"</code> 미부착 화면 존재 <span class="flag">접근성</span></td></tr>
</table>
`))

// ════════════════════════════════════════════════════════════════════════════
// 10. Components — Navigation
// ════════════════════════════════════════════════════════════════════════════
write('components/navigation.html', page(
  '내비게이션 (as-is)', 'Components',
  '사이드바 · 페이지 헤더 · 섹션 접기. Sidebar는 styles.ts를 전혀 쓰지 않고 독자 스타일로 작성돼 있다.',
  `
<h2>사이드바</h2>
<div style="display:flex;gap:20px">
<div style="width:210px;background:#fff;border-right:1px solid #f1f5f9;padding:18px 12px;border-radius:12px">
  <div style="display:flex;align-items:center;gap:8px;padding:0 8px 18px">
    <div style="width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#1A237E,#00695C);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">F</div>
    <div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:#1A237E;line-height:1.25">LAKIPIECE<br>FINANCE</div>
  </div>
  <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;font-size:12px;color:#475569;font-weight:500">가계부</div>
  ${['수입 지출 관리','예산관리','에너지 지출관리','연도비교','옵션'].map(l=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px 6px 26px;font-size:11px;color:#94a3b8">${l}</div>`).join('')}
  <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;font-size:12px;color:#1A237E;font-weight:600;background:#eff4ff;margin-top:6px">포트폴리오</div>
  ${['스냅샷','배당','계좌','종목','옵션','리밸런싱'].map(l=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px 6px 26px;font-size:11px;color:#94a3b8">${l}</div>`).join('')}
</div>
<div style="flex:1">
<table class="dt">
<tr><th style="width:120px">요소</th><th>현황</th></tr>
<tr><td>활성 표시</td><td>배경 + 텍스트색 동시 변경. 좌측 인디케이터 바 없음</td></tr>
<tr><td>섹션 · 하위 항목</td><td>12px / 11px, slate-600 / slate-400 — 위계는 있으나 토큰화 안 됨</td></tr>
<tr><td>아이콘</td><td>전부 인라인 SVG <code>w-4 h-4</code>, <code>strokeWidth=2</code>. 파일마다 중복 정의 <span class="flag">중복</span></td></tr>
<tr><td>스타일 소스</td><td><b>styles.ts import 없음</b> — 사이드바 전체가 하드코딩 <span class="flag">이탈</span></td></tr>
<tr><td>모바일</td><td>햄버거 → 오버레이 드로어. 오버레이 색이 modal.overlay와 다름</td></tr>
</table>
</div></div>

<h2>페이지 헤더 (ui/PageHeader.tsx) <span class="flag ok">17개 화면 사용</span></h2>
<div class="panel">
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
    <div><div style="font-size:20px;font-weight:700;color:#1A237E">포트폴리오</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:2px">전체 보유 현황 및 수익률</div></div>
    <div style="display:flex;align-items:center;gap:8px">
      <button style="${B.secondary}">2026</button>
      <button style="${B.primary}">추가</button>
    </div>
  </div>
</div>
<p class="note">가장 잘 정착된 공통 컴포넌트. 다만 <code>/expenses</code>, <code>/login</code> 등 일부 화면은 여전히 자체 타이틀 마크업을 쓴다.</p>

<h2>접기 섹션 · 탭</h2>
<div class="row">
  <div style="font-size:12px;color:#475569;display:inline-flex;align-items:center;gap:4px">섹터 <span style="color:#cbd5e1">›</span></div>
  <div style="font-size:12px;color:#475569;display:inline-flex;align-items:center;gap:4px">태그 <span style="color:#cbd5e1">›</span></div>
  <div style="font-size:12px;color:#475569;display:inline-flex;align-items:center;gap:4px">차트 <span style="color:#cbd5e1">›</span></div>
</div>
<p class="note">접기 섹션 헤더에 토큰이 없어 화면마다 화살표 방향·크기·간격이 다르다. 탭 컴포넌트는 아예 없고 <code>btn.pill</code>로 대체되고 있다.</p>
`))

// ════════════════════════════════════════════════════════════════════════════
// 11. Components — Feedback
// ════════════════════════════════════════════════════════════════════════════
write('components/feedback.html', page(
  '피드백 · 상태 (as-is)', 'Components',
  '툴팁·로딩·빈 상태. 이 영역이 가장 비어 있다 — 토스트가 없고 툴팁이 세 가지 방식으로 구현돼 있다.',
  `
<h2>툴팁 — 3가지 구현 <span class="flag">통합 필요</span></h2>
<div class="row" style="align-items:flex-start;gap:28px">
  <div style="position:relative;padding-top:34px">
    <div style="position:absolute;top:0;left:0;padding:4px 8px;background:#1A237E;color:#fff;font-size:10px;border-radius:8px;white-space:nowrap;box-shadow:0 10px 15px -3px rgb(0 0 0/.1)">현재 시장가 기준</div>
    <span style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">총 평가금액</span>
    <div class="dark-note">① CSS 호버 툴팁 — <code>group-hover/lbl:opacity-100</code>, 브랜드색 배경</div>
  </div>
  <div style="position:relative;padding-top:34px">
    <div style="position:absolute;top:0;left:0;padding:4px 8px;background:rgba(255,255,255,.2);color:#fff;font-size:10px;border-radius:8px;white-space:nowrap"><span style="color:#334155">투명 배경 변종</span></div>
    <span style="font-size:10px;color:#94a3b8">KPI 강조 카드 내부</span>
    <div class="dark-note">② 같은 컴포넌트인데 배경만 <code>bg-white/20</code></div>
  </div>
  <div style="padding-top:34px">
    <span style="font-size:12px;color:#475569;border-bottom:1px dotted #cbd5e1" title="네이티브 툴팁">수정 아이콘</span>
    <div class="dark-note">③ 네이티브 <code>title=""</code> — 59곳. 스타일 제어 불가, 모바일 미동작</div>
  </div>
</div>
<p class="note">차트 툴팁까지 포함하면 네 번째 체계가 된다(아래 Data Viz 카드 참조).</p>

<h2>로딩 (skeleton.*) <span class="flag">1회만 사용</span></h2>
<div class="panel" style="max-width:520px">
  <div style="height:16px;background:#f1f5f9;border-radius:4px;width:40%;margin-bottom:12px"></div>
  <div style="height:16px;background:#f1f5f9;border-radius:4px;width:75%;margin-bottom:16px"></div>
  <div style="height:96px;background:#f8fafc;border-radius:12px;margin-bottom:12px"></div>
  <div style="height:200px;background:#f8fafc;border-radius:12px"></div>
</div>
<p class="note"><code>skeleton.line / card / chart</code> 정의됨. 그러나 실제 <code>loading.tsx</code> 3개는 각자 다른 마크업을 쓴다. 스피너 토큰은 없다.</p>

<h2>빈 상태 — 통일 안 됨</h2>
<div class="row" style="align-items:stretch">
  <div style="flex:1;background:#fff;border:1px solid #f1f5f9;border-radius:16px;padding:32px;text-align:center">
    <div style="font-size:44px;margin-bottom:12px">📊</div>
    <div style="font-size:20px;font-weight:700;color:#334155">데이터가 없습니다</div>
    <div class="dark-note" style="margin-top:8px">연도비교 — 이모지 + text-xl</div>
  </div>
  <div style="flex:1;background:#fff;border:1px solid #f1f5f9;border-radius:16px;padding:32px;text-align:center;display:flex;flex-direction:column;justify-content:center">
    <div style="font-size:12px;color:#94a3b8">등록된 항목이 없습니다</div>
    <div class="dark-note" style="margin-top:8px">그 외 대부분 — 회색 한 줄</div>
  </div>
</div>

<h2>토스트 — 한 화면에만 존재</h2>
<div style="position:relative;height:96px;background:#f1f5f9;border-radius:16px;overflow:hidden">
  <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;font-size:12px;padding:8px 16px;border-radius:9999px;box-shadow:0 10px 15px -3px rgb(0 0 0/.1)">종목 수정 완료</div>
</div>
<p class="note"><code>PortfolioDashboard.tsx</code>에만 로컬 <code>useState</code>로 구현된 2초 토스트. 공통 컴포넌트가 아니라 다른 26개 화면은 쓸 수 없다. (겸사겸사 이 코드는 <code>&&</code> 조건부 렌더링을 써서 프로젝트 컨벤션과도 어긋난다.)</p>

<h2>없는 것들</h2>
<table class="dt">
<tr><th style="width:150px">패턴</th><th>현황</th></tr>
<tr><td>공통 토스트</td><td>위 1개 화면 외 전무 — 성공/실패가 <code>alert()</code> 5곳 <span class="flag">최우선</span></td></tr>
<tr><td>확인 다이얼로그</td><td>브라우저 <code>confirm()</code> <b>19곳</b></td></tr>
<tr><td>인라인 폼 에러</td><td>없음</td></tr>
<tr><td>진행률 표시</td><td>가격 수집·엑셀 임포트에 개별 구현</td></tr>
<tr><td><code>focus-visible</code></td><td>전 코드에서 <b>0회</b> — 키보드 포커스 스타일 미정의</td></tr>
<tr><td><code>role="dialog"</code></td><td>모달 9개 파일 전부 <b>미부착</b></td></tr>
</table>
`))

// ════════════════════════════════════════════════════════════════════════════
// 12. Data Viz — palette
// ════════════════════════════════════════════════════════════════════════════
write('dataviz/chart-palette.html', page(
  '차트 색상 (as-is)', 'Data Viz',
  '시리즈 색이 네 군데서 나온다 — 4색 팔레트+알파, 72색 사용자 지정, 파일별 하드코딩 상수, 회색 폴백.',
  `
<h2>① 팔레트 4색 + 알파 확장 (AllocationCharts)</h2>
<p class="note">시리즈가 5개를 넘으면 같은 색에 <code>CC</code>(80%) → <code>99</code>(60%) 알파를 붙여 12색을 만든다. 명도만 다른 같은 색상이 인접 세그먼트에 놓이면 구분이 어렵다.</p>
<div style="display:grid;grid-template-columns:repeat(12,1fr);gap:4px;margin-bottom:6px">
${['#1A237E','#690043','#00695C','#8D6E63','#1A237ECC','#690043CC','#00695CCC','#8D6E63CC','#1A237E99','#69004399','#00695C99','#8D6E6399']
  .map(c=>`<div style="height:44px;border-radius:8px;background:${c}"></div>`).join('')}
</div>
<div style="display:grid;grid-template-columns:repeat(12,1fr);gap:4px;font-size:8px;color:#94a3b8;text-align:center">
${['100%','100%','100%','100%','80%','80%','80%','80%','60%','60%','60%','60%'].map(t=>`<div>${t}</div>`).join('')}
</div>

<h2>② 파일별 하드코딩 상수</h2>
<table class="dt">
<tr><th style="width:210px">파일</th><th>상수</th></tr>
<tr><td><code>SnapshotCharts.tsx</code></td><td><span style="color:#ef4444;font-weight:600">POS #ef4444</span> / <span style="color:#3b82f6;font-weight:600">NEG #3b82f6</span> / 기타 <span style="color:#cbd5e1;font-weight:600">#cbd5e1</span></td></tr>
<tr><td><code>AllocationCharts.tsx</code></td><td>GREY <code>#e2e8f0</code></td></tr>
<tr><td><code>CashflowPanel.tsx</code></td><td>INFLOW / OUTFLOW <code>#690043</code> / opening <code>#64748b</code></td></tr>
<tr><td><code>DrilldownPanel.tsx</code></td><td>급여 <code>#4527A0</code> · 기타 <code>#5A6476</code> · 폴백 <code>#6B8CAE</code> · 선택 <code>#3b82f6</code></td></tr>
<tr><td><code>IncomeDashboard.tsx</code></td><td>배당 <code>#10b981</code> · 투자금 <code>#64748b</code> · 평가금 <code>#1A237E</code></td></tr>
</table>

<h2>③ 사용자 지정 72색이 섞여 들어오는 지점</h2>
<p class="note">계좌·카테고리·멤버에 사용자가 지정한 <code>OPTION_COLORS</code> 값이 그대로 차트 시리즈 색이 된다. 팔레트 색과 나란히 놓이면 채도·명도 리듬이 무너진다.</p>
<div class="row">
  <div style="display:flex;gap:0;border-radius:8px;overflow:hidden;height:40px;flex:1">
    ${[['#1A237E',26],['#690043',14],['#F9A825',11],['#00695C',18],['#607D8B',9],['#D81B60',12],['#8D6E63',10]]
      .map(([c,w])=>`<div style="width:${w}%;background:${c}"></div>`).join('')}
  </div>
</div>
<p class="note">↑ 팔레트색(#1A237E·#690043·#00695C·#8D6E63)과 사용자색(#F9A825·#607D8B·#D81B60)이 한 스택 바에 공존하는 실제 상황.</p>

<h2>손익 색 3중 정의</h2>
<div class="row">
  <div style="text-align:center"><div style="width:80px;height:36px;border-radius:8px;background:#f43f5e"></div><div class="sw-hex">rose-500<br>텍스트</div></div>
  <div style="text-align:center"><div style="width:80px;height:36px;border-radius:8px;background:#ef4444"></div><div class="sw-hex">#ef4444<br>차트</div></div>
  <div style="text-align:center"><div style="width:80px;height:36px;border-radius:8px;background:#dc2626"></div><div class="sw-hex">#dc2626<br>배당 화면</div></div>
  <div style="width:16px"></div>
  <div style="text-align:center"><div style="width:80px;height:36px;border-radius:8px;background:#3b82f6"></div><div class="sw-hex">blue-500<br>텍스트·차트</div></div>
  <div style="text-align:center"><div style="width:80px;height:36px;border-radius:8px;background:#2563eb"></div><div class="sw-hex">#2563eb<br>배당 화면</div></div>
</div>
`))

// ════════════════════════════════════════════════════════════════════════════
// 13. Data Viz — chrome
// ════════════════════════════════════════════════════════════════════════════
write('dataviz/chart-chrome.html', page(
  '차트 축 · 그리드 · 툴팁 (as-is)', 'Data Viz',
  'Recharts 47개 차트. 그리드/축 색은 사실상 통일됐지만 폰트 크기·툴팁 스타일·막대 라운딩이 제각각이다.',
  `
<h2>표준형 (가장 흔한 조합)</h2>
<div class="panel">
<svg width="100%" height="190" viewBox="0 0 620 190">
  <g stroke="#f1f5f9" stroke-dasharray="3 3">
    ${[30,70,110,150].map(y=>`<line x1="46" y1="${y}" x2="600" y2="${y}"/>`).join('')}
  </g>
  ${[['1월',60],['2월',96],['3월',44],['4월',120],['5월',82],['6월',108],['7월',70],['8월',134]]
    .map(([m,h],i)=>{const x=60+i*68;return `
    <rect x="${x}" y="${150-h}" width="30" height="${h}" rx="3" fill="#1A237E"/>
    <rect x="${x}" y="${150-h-26}" width="30" height="26" rx="3" fill="#00695C"/>
    <text x="${x+15}" y="170" font-size="11" fill="#94a3b8" text-anchor="middle">${m}</text>`}).join('')}
  ${[0,1,2,3].map(i=>`<text x="40" y="${154-i*40}" font-size="10" fill="#94a3b8" text-anchor="end">${i*500}만</text>`).join('')}
</svg>
</div>
<table class="dt" style="margin-top:14px">
<tr><th style="width:170px">요소</th><th>값</th><th style="width:150px">일관성</th></tr>
<tr><td>CartesianGrid</td><td><code>strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}</code></td><td><span class="flag ok">23/24 동일</span></td></tr>
<tr><td>축 tick 색</td><td><code>#94a3b8</code></td><td><span class="flag ok">전부 동일</span></td></tr>
<tr><td>축 tick 크기</td><td><code>9px ×6 · 10px ×22 · 11px ×8 · 12px ×4</code></td><td><span class="flag">4단계 혼재</span></td></tr>
<tr><td>axisLine · tickLine</td><td><code>false</code></td><td><span class="flag ok">일관</span></td></tr>
<tr><td>Bar radius</td><td><code>[0,0,0,0] [2,2,0,0] [3,3,0,0] [4,4,0,0] [4,4,4,4] [0,3,3,0] [0,4,4,0]</code></td><td><span class="flag">7종</span></td></tr>
<tr><td>Line</td><td><code>strokeWidth={2} dot={false} activeDot={{r:4}}</code></td><td><span class="flag ok">일관</span></td></tr>
<tr><td>Legend 텍스트</td><td><code>#64748b</code>, 12px</td><td>범례 자체를 안 쓰는 차트가 다수</td></tr>
</table>

<h2>툴팁 — 5가지 contentStyle</h2>
<div class="row" style="align-items:flex-start">
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;font-size:13px;padding:10px 12px;color:#334155">
    <div style="font-weight:600;margin-bottom:4px">2026년 3월</div><div>지출 <b>1,240,000원</b></div>
    <div class="dark-note" style="margin-top:6px">radius 12 · 13px — 5곳</div>
  </div>
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;padding:8px 10px;color:#334155">
    <div style="font-weight:600;margin-bottom:4px">2026년 3월</div><div>지출 <b>1,240,000원</b></div>
    <div class="dark-note" style="margin-top:6px">radius 8 · 12px — 4곳</div>
  </div>
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;padding:6px 10px;color:#334155">
    <div style="font-weight:600;margin-bottom:3px">2026년 3월</div><div>지출 <b>1,240,000원</b></div>
    <div class="dark-note" style="margin-top:6px">radius 8 · 11px — 4곳</div>
  </div>
  <div style="background:#fff;border-radius:12px;box-shadow:0 10px 15px -3px rgb(0 0 0/.1);font-size:11px;padding:8px 12px;color:#334155">
    <div style="font-weight:600;margin-bottom:3px">배당금</div><div style="color:#1A237E"><b>1,240,000원</b></div>
    <div class="dark-note" style="margin-top:6px">커스텀 content 컴포넌트 — 테두리 대신 그림자</div>
  </div>
</div>
<p class="note">앱 UI 툴팁(3종)과 합치면 <b>툴팁 표현이 총 7가지</b>다. 커서 하이라이트도 <code>cursor={{fill:'#f8fafc'}}</code>를 쓰는 차트와 기본값을 쓰는 차트로 갈린다.</p>

<h2>차트 컨테이너</h2>
<p class="note">높이가 <code>h-[200px] h-[220px] h-[260px] h-[280px] h-[300px]</code>로 화면마다 다르고, 제목·범례·필터 pill의 배치 순서도 통일돼 있지 않다.</p>
`))

// ════════════════════════════════════════════════════════════════════════════
// 14. Patterns — KPI
// ════════════════════════════════════════════════════════════════════════════
write('patterns/kpi-metrics.html', page(
  'KPI · 지표 표기 (as-is)', 'Patterns',
  '금액을 보여주는 방식이 화면마다 다르다. 이 앱의 정체성이 가장 강하게 드러나는 영역이자 편차가 가장 큰 영역.',
  `
<h2>포트폴리오 KPI 행 — 5칸</h2>
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">
  <div style="border-radius:16px;box-shadow:0 4px 6px -1px rgb(0 0 0/.1);padding:16px;position:relative;overflow:hidden;background:linear-gradient(135deg,#1A237E 0%,#283593 60%,#00695C 100%);height:100px;display:flex;flex-direction:column">
    <div style="font-size:10px;color:#bfdbfe;font-weight:600;text-transform:uppercase;letter-spacing:.1em">총 평가금액</div>
    <div style="margin-top:auto;text-align:right;font-size:19px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums">128,450,000원</div>
    <div style="position:absolute;right:-16px;bottom:-16px;width:80px;height:80px;border-radius:9999px;background:#fff;opacity:.1"></div>
  </div>
  ${[['투자원금','112,300,000원','#334155'],['평가손익','+16,150,000원','#f43f5e'],['수익금액','+18,940,000원','#f43f5e'],['누적 분배금','1,860,000원','#334155']]
    .map(([l,v,c])=>`<div style="background:#fff;border-radius:16px;border:1px solid #f1f5f9;box-shadow:0 1px 2px 0 rgb(0 0 0/.05);padding:16px;height:100px;display:flex;flex-direction:column">
      <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">${l}</div>
      <div style="margin-top:auto;text-align:right;font-size:17px;font-weight:700;color:${c};font-variant-numeric:tabular-nums">${v}</div></div>`).join('')}
</div>
<table class="dt" style="margin-top:14px">
<tr><th style="width:160px">축</th><th>강조 카드</th><th>일반 카드</th></tr>
<tr><td>값 크기</td><td><code>text-xl sm:text-2xl</code></td><td><code>text-lg sm:text-xl</code> <span class="flag">1단 차이</span></td></tr>
<tr><td>레이블 트래킹</td><td><code>tracking-widest</code></td><td><code>tracking-wider</code> <span class="flag">불일치</span></td></tr>
<tr><td>그림자</td><td><code>shadow-md</code></td><td><code>shadow-sm</code> + 테두리</td></tr>
<tr><td>부가 설명</td><td colspan="2">호버 툴팁으로만 노출 — 마우스 없는 환경에선 볼 수 없다 <span class="flag">모바일</span></td></tr>
</table>

<h2>다른 화면의 같은 역할 카드</h2>
<div class="row" style="align-items:stretch">
  <div style="flex:1;background:#fff;border:1px solid #f1f5f9;border-radius:16px;padding:16px">
    <div style="font-size:11px;color:#94a3b8">연간 예산</div>
    <div style="font-size:18px;font-weight:700;color:#1e293b;margin-top:4px;font-variant-numeric:tabular-nums">48,000,000원</div>
    <div class="dark-note">예산관리 — 레이블 11px, 소문자, 좌측 정렬 값</div>
  </div>
  <div style="flex:1;background:#fff;border:1px solid #f1f5f9;border-radius:16px;padding:16px">
    <div style="font-size:11px;color:#94a3b8">총 배당금</div>
    <div style="font-size:20px;font-weight:700;color:#1A237E;margin-top:4px;font-variant-numeric:tabular-nums">1,860,000원</div>
    <div class="dark-note">배당 — 값이 <b>브랜드색</b>, 크기 text-xl~2xl</div>
  </div>
  <div style="flex:1;background:#fff;border:1px solid #f1f5f9;border-radius:12px;padding:12px">
    <div style="font-size:10px;color:#94a3b8">평가금액</div>
    <div style="font-size:13px;font-weight:700;color:#334155;margin-top:2px;font-variant-numeric:tabular-nums">24,180,000원</div>
    <div class="dark-note">계좌 타일 — 라운딩 12px, 값 13px</div>
  </div>
</div>
<p class="note">같은 "금액 KPI"인데 레이블 크기(10/11px)·대문자 여부·값 크기(13~24px)·값 색(slate-800/브랜드/손익색)·정렬(좌/우)이 모두 다르다.</p>

<h2>손익 표기 규칙</h2>
<div class="row">
  <span style="font-size:13px;font-weight:600;color:#f43f5e;font-variant-numeric:tabular-nums">+16,150,000원</span>
  <span style="font-size:13px;font-weight:600;color:#f43f5e;font-variant-numeric:tabular-nums">+8.5%</span>
  <span style="font-size:13px;font-weight:600;color:#3b82f6;font-variant-numeric:tabular-nums">−262,000원</span>
  <span style="font-size:13px;font-weight:600;color:#3b82f6;font-variant-numeric:tabular-nums">−12.4%</span>
</div>
<p class="note">부호는 <code>+</code>를 직접 붙이고 음수는 <code>-</code>(하이픈)을 그대로 쓴다. 화살표 아이콘·배경 배지 방식은 쓰지 않는다 — 이 규칙 자체는 전 화면 일관.</p>
`))

// ════════════════════════════════════════════════════════════════════════════
// 15. Audit summary
// ════════════════════════════════════════════════════════════════════════════
write('audit/summary.html', page(
  '통합 진단 — 무엇을 정해야 하는가', 'Audit',
  '27개 화면·73개 컴포넌트 전수 조사 결과. 큰 문제는 "스타일이 없다"가 아니라 "정본이 두 벌"이라는 점이다.',
  `
<h2>한 줄 요약</h2>
<div class="panel" style="margin-bottom:20px">
<p style="margin:0;font-size:13px;line-height:1.85;color:#334155">
디자인 토큰 파일(<code>lib/styles.ts</code>)과 문서(<code>docs/design-system.md</code>)는 이미 충실하다. 문제는 <b>그 안에 서로 다른 두 디자인 철학이 동시에 살아 있고, 화면은 그중 옛 쪽만 쓰고 있다</b>는 것이다.
"The Orchestrated Lens"(테두리 없는 배경 레이어링 + 글래스 + 그라디언트 CTA)로 설계된 <code>surface · glass · cta · statusBadge · font · layout</code> 6개 토큰 그룹은 <b>단 한 번도 import되지 않았다.</b>
</p>
</div>

<h2>토큰 그룹별 실사용</h2>
<table class="dt">
<tr><th style="width:130px">토큰 그룹</th><th style="width:80px">사용</th><th>상태</th></tr>
${[['field','155회','정착 — 앱의 실질 표준','ok'],
   ['btn','58회','정착 — 단, 배경색을 style prop으로 넘기는 암묵 계약이 있다','ok'],
   ['modal','45회','정착','ok'],
   ['tbl','35회','정착','ok'],
   ['card','13회','부분 정착 — 나머지는 같은 클래스를 직접 하드코딩','warn'],
   ['badge','9회','부분 정착','warn'],
   ['text','7회','거의 미사용 — <code>text-xs</code> 310회가 직접 박혀 있다','warn'],
   ['skeleton','1회','사실상 미사용','warn'],
   ['surface','0회','죽은 토큰','dead'],
   ['glass','0회','죽은 토큰','dead'],
   ['cta','0회','죽은 토큰 — btn.primary와 규격 충돌','dead'],
   ['statusBadge','0회','죽은 토큰 — badge.*와 규격 충돌','dead'],
   ['font','0회','죽은 토큰 — text.*와 규격 충돌','dead'],
   ['layout','0회','죽은 토큰','dead']]
  .map(([t,n,s,f])=>`<tr><td><code>${t}.*</code></td><td>${n}</td><td>${s} ${f==='ok'?'<span class="flag ok">양호</span>':f==='dead'?'<span class="flag dead">삭제 또는 승격</span>':'<span class="flag">보강</span>'}</td></tr>`).join('')}
</table>

<h2>결정이 필요한 5가지</h2>
<table class="dt">
<tr><th style="width:34px">#</th><th style="width:170px">쟁점</th><th>선택지</th></tr>
<tr><td>1</td><td>표면 표현</td><td><b>A.</b> 현행 유지 — 흰 카드 + 1px slate-100 테두리 + shadow-sm &nbsp;/&nbsp; <b>B.</b> 설계안 채택 — 테두리 제거, #f8f9ff→#eff4ff→#fff 배경 레이어링</td></tr>
<tr><td>2</td><td>버튼 정본</td><td><b>A.</b> <code>btn.*</code>(8px·테마색·py-1.5) &nbsp;/&nbsp; <b>B.</b> <code>cta.*</code>(6px·그라디언트·py-2) &nbsp;/&nbsp; <b>C.</b> 새 규격 + size 3단계 신설</td></tr>
<tr><td>3</td><td>배지 정본</td><td><b>A.</b> solid(<code>badge.*</code>) &nbsp;/&nbsp; <b>B.</b> 10% 투명(<code>statusBadge.*</code>) &nbsp;/&nbsp; <b>C.</b> 의미별 분리 — 분류=solid, 상태=투명</td></tr>
<tr><td>4</td><td>타이포 계단</td><td>12단계(7~48px) → <b>6단계로 축소</b>. <code>[9px] [11px] [13px]</code> 임의값을 어디에 흡수시킬지 결정</td></tr>
<tr><td>5</td><td>차트 시리즈 색</td><td>4색+알파 확장을 유지할지, <b>명도·색상이 함께 도는 8~10색 정규 팔레트</b>를 새로 만들지</td></tr>
</table>

<h2>결정과 무관하게 채워야 할 빈칸</h2>
<table class="dt">
<tr><th style="width:150px">항목</th><th>현재</th></tr>
<tr><td>공통 토스트</td><td>1개 화면에만 로컬 구현 · 나머지는 <code>alert()</code> 5곳 <span class="flag">최우선</span></td></tr>
<tr><td>확인 다이얼로그</td><td>브라우저 <code>confirm()</code> 19곳</td></tr>
<tr><td>폼 에러 상태</td><td>정의 없음</td></tr>
<tr><td>버튼 focus-visible</td><td>전 버튼 미정의 — 키보드 접근성</td></tr>
<tr><td>버튼 size 단계</td><td>단일 크기만 존재</td></tr>
<tr><td>탭 컴포넌트</td><td>없음 — <code>btn.pill</code>로 대체 중</td></tr>
<tr><td>아이콘 세트</td><td>인라인 SVG가 파일마다 중복 정의 — 공통 <code>ui/icons.tsx</code> 부재</td></tr>
<tr><td>모바일 테이블</td><td>카드 전환 규칙 없음</td></tr>
</table>

<h2>접근성 (WCAG AA 기준 미달 지점)</h2>
<table class="dt">
<tr><th style="width:200px">대상</th><th style="width:90px">대비</th><th>비고</th></tr>
<tr><td>placeholder <code>slate-300</code> / 흰 배경</td><td>1.5 : 1</td><td>기준 4.5:1</td></tr>
<tr><td>아이콘 버튼 기본 <code>slate-300</code></td><td>1.5 : 1</td><td>기준 3:1 (UI 컴포넌트)</td></tr>
<tr><td>차트 축·레이블 <code>slate-400</code> / 흰 배경</td><td>2.6 : 1</td><td>기준 4.5:1 — 앱 전체에서 가장 많이 쓰이는 보조 텍스트색</td></tr>
<tr><td>캡션 <code>text-[10px] slate-400</code></td><td>2.6 : 1</td><td>10px 크기까지 겹쳐 가독성 낮음</td></tr>
<tr><td>본문 <code>slate-600</code> · 메타 <code>slate-500</code></td><td>7.6 : 1 · 4.8 : 1</td><td><span class="flag ok">통과</span></td></tr>
</table>
<p class="note">가장 큰 지렛대는 <b>보조 텍스트를 <code>slate-400</code> → <code>slate-500</code>으로 한 단계 올리는 것</b>이다. 이 한 번의 치환으로 2.6:1 → 4.8:1이 되며, 영향 범위는 레이블·캡션·차트 축 전체다.</p>
`))

console.log('\n완료 →', OUT)
