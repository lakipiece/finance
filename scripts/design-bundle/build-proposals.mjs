/**
 * 시안 3종 — 동일한 화면 조각을 세 가지 방향으로 렌더링해 비교
 * 출력: docs/design-bundle/proposals/*.html
 */
import fs from 'fs'
import path from 'path'
const OUT = path.resolve('/Users/lakipiece/dev/finance/docs/design-bundle/proposals')

// 각 시안이 정의하는 토큰
const T = {
  A: {
    key: 'A', name: '시안 A — 현행 정제 (Refined Ledger)',
    tag: '리스크 최소 · 코드 변경 국소',
    desc: '지금의 "흰 카드 + 얇은 테두리" 언어를 정본으로 확정하고, 흩어진 값만 계단으로 정리한다. 죽은 토큰 6그룹을 삭제하고 대비·크기 규칙만 바로잡는 방향.',
    bg: '#f6f8fc', canvas: '#fff', card: '#fff',
    cardBorder: '1px solid #e8edf5', cardRadius: '16px', cardShadow: '0 1px 2px 0 rgba(13,28,46,.04)',
    ink: '#1e293b', body: '#475569', meta: '#64748b', faint: '#94a3b8',
    accent: '#1A237E', accentSoft: '#eef1fa',
    btnRadius: '8px', btnPad: '7px 14px', btnWeight: '600',
    pos: '#e11d48', neg: '#2563eb',
    series: ['#1A237E', '#00695C', '#690043', '#8D6E63', '#3949AB', '#26A69A'],
    gridColor: '#eef2f7', barRadius: 3,
    labelStyle: 'font-size:11px;color:#64748b;font-weight:500',
    metricSize: '22px',
    notes: [
      ['표면', '흰 카드 + <code>#e8edf5</code> 1px 테두리 + 미세 그림자 — 현행 유지, 테두리 색만 한 단계 또렷하게'],
      ['타이포', '11 · 12 · 14 · 16 · 20 · 28 <b>6단계로 고정</b>. <code>[9px] [10px] [13px]</code> 폐기'],
      ['보조 텍스트', '<code>slate-400</code> → <code>slate-500</code> 승격 (대비 2.6:1 → 4.8:1)'],
      ['버튼', '<code>btn.*</code> 규격 유지 + sm/md/lg 3단계 + <code>focus-visible</code> 링 추가'],
      ['배지', 'solid 유지. 분류=solid / 상태=투명으로 역할 분리'],
      ['차트', '4색 + 알파 확장 폐기 → 6색 정규 팔레트, 막대 라운딩 3px 통일'],
      ['작업량', '토큰 정리 + 치환 위주. 레이아웃 변경 거의 없음'],
    ],
  },
  B: {
    key: 'B', name: '시안 B — 표면 레이어링 (Orchestrated Lens 완성)',
    tag: '이미 문서에 쓰인 철학을 실제로 구현',
    desc: '테두리를 걷어내고 배경 톤의 이동만으로 깊이를 만든다. tailwind.config.ts에 이미 등록된 surface 토큰 6종을 실제로 쓰기 시작하는 방향.',
    bg: '#f8f9ff', canvas: '#eff4ff', card: '#ffffff',
    cardBorder: 'none', cardRadius: '18px', cardShadow: '0 4px 32px 0 rgba(13,28,46,.06)',
    ink: '#0d1c2e', body: '#3d4a5c', meta: '#5b6a80', faint: '#8794a8',
    accent: '#131b2e', accentSoft: '#dce9ff',
    btnRadius: '10px', btnPad: '8px 16px', btnWeight: '600',
    pos: '#e11d48', neg: '#2563eb',
    series: ['#1A237E', '#00695C', '#690043', '#8D6E63', '#3949AB', '#26A69A'],
    gridColor: '#e6eeff', barRadius: 4,
    labelStyle: 'font-size:11px;color:#5b6a80;font-weight:500',
    metricSize: '24px',
    notes: [
      ['표면', '<code>#f8f9ff</code> 바닥 → <code>#eff4ff</code> 캔버스 → <code>#fff</code> 카드. <b>테두리 0</b>, 넓은 확산 그림자로 부상'],
      ['타이포', '11 · 12 · 14 · 16 · 20 · 28. 텍스트색은 순수 회색 대신 <code>#0d1c2e</code> 계열 블루그레이'],
      ['버튼', '주 CTA는 잉크 네이비 <code>#131b2e</code> 솔리드, 보조는 <code>#dce9ff</code> 배경·테두리 없음'],
      ['배지', '전면 10% 틴트 방식 — <code>statusBadge.*</code> 승격'],
      ['모달', '글래스 오버레이 <code>#0d1c2e/30 + blur(6px)</code>'],
      ['차트', '카드가 흰색이므로 그리드는 <code>#e6eeff</code>. 막대 라운딩 4px로 부드럽게'],
      ['작업량', '카드·모달·사이드바 전면 치환. 화면 인상이 가장 크게 바뀐다'],
    ],
  },
  C: {
    key: 'C', name: '시안 C — 데이터 우선 (Precision Terminal)',
    tag: '정보 밀도 최대 · 금융 단말기 지향',
    desc: '장식을 걷어내고 숫자를 주인공으로 둔다. 카드 대신 얇은 규칙선(rule)으로 구획하고, 여백을 줄여 한 화면에 더 많은 행을 담는 방향.',
    bg: '#ffffff', canvas: '#fbfcfd', card: '#ffffff',
    cardBorder: '1px solid #e6e9ef', cardRadius: '8px', cardShadow: 'none',
    ink: '#0f172a', body: '#334155', meta: '#5b6b82', faint: '#8496ad',
    accent: '#101a3d', accentSoft: '#f1f3f9',
    btnRadius: '6px', btnPad: '6px 14px', btnWeight: '600',
    pos: '#d81e3f', neg: '#1d5fd0',
    series: ['#101a3d', '#00695C', '#7a1046', '#8D6E63', '#3f5aa8', '#1f8a7a'],
    gridColor: '#eef0f4', barRadius: 0,
    labelStyle: 'font-size:10px;color:#5b6b82;font-weight:600;text-transform:uppercase;letter-spacing:.08em',
    metricSize: '24px',
    notes: [
      ['표면', '흰 배경 + <code>#e6e9ef</code> 헤어라인 규칙선. 그림자·라운딩 최소(8px)'],
      ['타이포', '숫자는 <b>등폭 고정</b>(tabular + 약간 좁은 자간), 레이블은 10px 대문자 트래킹'],
      ['밀도', '행 높이 −20%, 카드 패딩 −25%. 같은 화면에 20~25% 더 많은 정보'],
      ['버튼', '작고 각진 형태. 주 액션만 잉크색 솔리드, 나머지는 텍스트 버튼'],
      ['색', '색은 <b>의미가 있을 때만</b> — 손익 빨강/파랑, 브랜드 잉크, 그 외 전부 무채색'],
      ['차트', '막대 라운딩 0, 그리드 최소, 축 레이블 10px. 스파크라인 적극 활용'],
      ['작업량', '토큰 + 밀도 규칙 동시 변경. 모바일에서 재조정 필요'],
    ],
  },
}

const specimen = (t) => {
  const kpi = (label, value, color, primary) => `
    <div style="background:${primary ? t.accent : t.card};${primary ? '' : `border:${t.cardBorder};`}
      border-radius:${t.cardRadius};box-shadow:${primary ? 'none' : t.cardShadow};padding:14px 16px;
      display:flex;flex-direction:column;min-height:88px">
      <div style="${primary ? t.labelStyle.replace(/color:[^;]+/, 'color:rgba(255,255,255,.72)') : t.labelStyle}">${label}</div>
      <div style="margin-top:auto;font-size:${t.metricSize};font-weight:700;font-variant-numeric:tabular-nums;
        letter-spacing:-.01em;color:${primary ? '#fff' : (color ?? t.ink)};text-align:right">${value}</div>
    </div>`

  const bar = (i, h, h2) => {
    const x = 44 + i * 62
    return `<rect x="${x}" y="${132 - h}" width="26" height="${h}" rx="${t.barRadius}" fill="${t.series[0]}"/>
            <rect x="${x}" y="${132 - h - h2}" width="26" height="${h2}" rx="${t.barRadius}" fill="${t.series[1]}"/>`
  }

  return `
<div style="background:${t.bg};padding:22px;border-radius:${t.cardRadius}">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div>
      <div style="font-size:20px;font-weight:700;color:${t.key === 'B' ? t.ink : t.accent}">포트폴리오</div>
      <div style="font-size:12px;color:${t.meta};margin-top:2px">전체 보유 현황 및 수익률</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button style="padding:${t.btnPad};border-radius:${t.btnRadius};font-size:12px;font-weight:${t.btnWeight};
        border:${t.key === 'B' ? 'none' : '1px solid #dfe5ee'};background:${t.key === 'B' ? t.accentSoft : '#fff'};
        color:${t.body};cursor:pointer">2026</button>
      <button style="padding:${t.btnPad};border-radius:${t.btnRadius};font-size:12px;font-weight:${t.btnWeight};
        border:none;background:${t.accent};color:#fff;cursor:pointer">종목 추가</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
    ${kpi('총 평가금액', '128,450,000원', null, true)}
    ${kpi('투자원금', '112,300,000원', t.ink, false)}
    ${kpi('평가손익', '+16,150,000원', t.pos, false)}
    ${kpi('누적 분배금', '1,860,000원', t.ink, false)}
  </div>

  <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:10px">
    <div style="background:${t.card};border:${t.cardBorder};border-radius:${t.cardRadius};box-shadow:${t.cardShadow};padding:16px">
      <div style="font-size:13px;font-weight:600;color:${t.ink};margin-bottom:10px">월별 평가액</div>
      <svg width="100%" height="150" viewBox="0 0 400 150">
        <g stroke="${t.gridColor}" ${t.key === 'C' ? '' : 'stroke-dasharray="3 3"'}>
          ${[36, 68, 100, 132].map(y => `<line x1="32" y1="${y}" x2="392" y2="${y}"/>`).join('')}
        </g>
        ${[[52, 22], [74, 30], [46, 18], [92, 26], [66, 34], [104, 20]].map(([h, h2], i) => bar(i, h, h2)).join('')}
        ${['3월', '4월', '5월', '6월', '7월', '8월'].map((m, i) =>
          `<text x="${57 + i * 62}" y="146" font-size="10" fill="${t.faint}" text-anchor="middle">${m}</text>`).join('')}
      </svg>
    </div>
    <div style="background:${t.card};border:${t.cardBorder};border-radius:${t.cardRadius};box-shadow:${t.cardShadow};padding:16px">
      <div style="font-size:13px;font-weight:600;color:${t.ink};margin-bottom:10px">계좌별 비중</div>
      <table style="width:100%;border-collapse:collapse">
        ${[['Laki-ISA', '24,180,000원', '+8.5%', true], ['Piece-IRP회사', '21,650,000원', '+9.0%', true],
           ['Laki-카카오증권', '19,720,000원', '+13.6%', true], ['삼성전자', '3,120,000원', '−12.4%', false]]
          .map(([n, v, p, up], i) => `<tr style="border-bottom:1px solid ${t.gridColor};
            ${t.key === 'A' && i % 2 === 1 ? 'background:#fafbfd;' : ''}">
            <td style="padding:${t.key === 'C' ? '5px 0' : '7px 0'};font-size:12px;color:${t.body}">
              <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background:${t.series[i % t.series.length]};margin-right:7px"></span>${n}</td>
            <td style="padding:${t.key === 'C' ? '5px 0' : '7px 0'};font-size:12px;color:${t.ink};text-align:right;font-variant-numeric:tabular-nums">${v}</td>
            <td style="padding:${t.key === 'C' ? '5px 0 5px 10px' : '7px 0 7px 10px'};font-size:12px;text-align:right;
              font-variant-numeric:tabular-nums;color:${up ? t.pos : t.neg}">${p}</td></tr>`).join('')}
      </table>
      <div style="display:flex;gap:6px;margin-top:14px;flex-wrap:wrap">
        <span style="padding:2px 9px;border-radius:${t.key === 'C' ? '4px' : '9999px'};font-size:10px;font-weight:600;
          background:${t.key === 'B' ? 'rgba(16,185,129,.12)' : '#e8f5ee'};color:#047857">정상</span>
        <span style="padding:2px 9px;border-radius:${t.key === 'C' ? '4px' : '9999px'};font-size:10px;font-weight:600;
          background:${t.key === 'B' ? 'rgba(245,158,11,.12)' : '#fdf3e3'};color:#b45309">리밸런싱 필요</span>
        <span style="padding:2px 9px;border-radius:${t.key === 'C' ? '4px' : '9999px'};font-size:10px;font-weight:600;
          background:${t.accentSoft};color:${t.accent}">ISA</span>
        <span style="padding:2px 9px;border-radius:${t.key === 'C' ? '4px' : '9999px'};font-size:10px;font-weight:700;
          font-family:ui-monospace,monospace;background:${t.accentSoft};color:${t.accent}">AAPL</span>
      </div>
    </div>
  </div>
</div>`
}

const CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#0d1c2e;-webkit-font-smoothing:antialiased}
.wrap{padding:28px 32px 40px;max-width:1120px}
h1{font-size:20px;font-weight:700;color:#1A237E;margin:0 0 4px}
.tag{display:inline-block;font-size:10px;font-weight:600;padding:3px 9px;border-radius:9999px;background:#eef1fa;color:#1A237E;margin-bottom:10px}
.lede{font-size:12px;color:#64748b;margin:0 0 20px;line-height:1.7;max-width:760px}
h2{font-size:13px;font-weight:600;color:#334155;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid #f1f5f9}
table.dt{width:100%;border-collapse:collapse;font-size:11px}
table.dt th{text-align:left;padding:6px 10px;color:#94a3b8;font-weight:500;border-bottom:1px solid #f1f5f9}
table.dt td{padding:7px 10px;color:#475569;border-bottom:1px solid #f8fafc;line-height:1.6}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;background:#f1f5f9;color:#475569;padding:1px 5px;border-radius:4px}
.sw{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.sw div{text-align:center}
.sw i{display:block;width:64px;height:34px;border-radius:6px}
.sw span{display:block;font-size:9px;color:#94a3b8;font-family:ui-monospace,monospace;margin-top:4px}
`

fs.mkdirSync(OUT, { recursive: true })
for (const k of ['A', 'B', 'C']) {
  const t = T[k]
  const html = `<!-- @dsCard group="시안 (To-be)" -->
<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.name}</title>
<style>${CSS}</style></head><body><div class="wrap">
<h1>${t.name}</h1>
<div class="tag">${t.tag}</div>
<p class="lede">${t.desc}</p>

<h2>같은 화면, 이 시안으로</h2>
${specimen(t)}

<h2>토큰</h2>
<div class="sw">
  <div><i style="background:${t.bg};border:1px solid #e6e9ef"></i><span>${t.bg}<br>바닥</span></div>
  <div><i style="background:${t.canvas};border:1px solid #e6e9ef"></i><span>${t.canvas}<br>캔버스</span></div>
  <div><i style="background:${t.card};border:1px solid #e6e9ef"></i><span>${t.card}<br>카드</span></div>
  <div><i style="background:${t.accent}"></i><span>${t.accent}<br>액션</span></div>
  <div><i style="background:${t.pos}"></i><span>${t.pos}<br>상승</span></div>
  <div><i style="background:${t.neg}"></i><span>${t.neg}<br>하락</span></div>
</div>
<div class="sw">
  ${t.series.map(c => `<div><i style="background:${c}"></i><span>${c}</span></div>`).join('')}
</div>
<p style="font-size:11px;color:#94a3b8;margin:0 0 6px">↑ 차트 시리즈 6색 — 알파 확장 없이 색상·명도가 함께 돌도록 구성</p>

<h2>규칙</h2>
<table class="dt">
<tr><th style="width:110px">축</th><th>내용</th></tr>
${t.notes.map(([k2, v]) => `<tr><td><b>${k2}</b></td><td>${v}</td></tr>`).join('')}
</table>
</div></body></html>
`
  fs.writeFileSync(path.join(OUT, `proposal-${k.toLowerCase()}.html`), html)
  console.log('  ✓ proposals/proposal-' + k.toLowerCase() + '.html')
}
