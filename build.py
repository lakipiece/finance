"""
2022 가계부 대시보드 빌드 스크립트
실행: python build.py
결과: index.html 생성
"""
import openpyxl
import json
import warnings
from collections import defaultdict

warnings.filterwarnings('ignore')

print("Excel 파일 읽는 중...")
wb = openpyxl.load_workbook('data/2022 가계부.xlsx', data_only=True)
ws = wb['지출내역']

CATEGORY_COLORS = {
    '고정비': '#3B82F6',
    '대출상환': '#EF4444',
    '변동비': '#10B981',
    '여행공연비': '#F59E0B',
}

monthly = defaultdict(lambda: defaultdict(float))
methods = defaultdict(float)
top_expenses = []
detail_by_cat = defaultdict(lambda: defaultdict(float))

MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비']

for row in ws.iter_rows(min_row=2, values_only=True):
    date_val = row[1]
    month_val = row[2]
    cat = row[5]
    detail = row[6]
    method = row[7]
    amt = row[8]

    if not amt or not cat:
        continue
    try:
        amt = float(amt)
    except:
        continue
    if amt <= 0:
        continue
    if not hasattr(month_val, 'month'):
        continue

    mn = month_val.month
    monthly[mn][str(cat)] += amt
    if method:
        methods[str(method)] += amt
    detail_by_cat[str(cat)][str(detail) if detail else '기타'] += amt

    date_str = date_val.strftime('%Y-%m-%d') if hasattr(date_val, 'strftime') else ''
    top_expenses.append({
        'date': date_str,
        'month': mn,
        'cat': str(cat),
        'detail': str(detail) if detail else '',
        'method': str(method) if method else '',
        'amt': amt
    })

# ─── 집계 ───────────────────────────────────────────────────────────────────
total = sum(v for d in monthly.values() for v in d.values())
cat_totals = {c: sum(monthly[m].get(c, 0) for m in range(1, 13)) for c in CATEGORIES}

monthly_list = []
for m in range(1, 13):
    entry = {'month': MONTH_NAMES[m-1]}
    for c in CATEGORIES:
        entry[c] = int(monthly[m].get(c, 0))
    entry['total'] = sum(entry[c] for c in CATEGORIES)
    monthly_list.append(entry)

max_month = max(monthly_list, key=lambda x: x['total'])
min_month = min(monthly_list, key=lambda x: x['total'])

top_10 = sorted(top_expenses, key=lambda x: -x['amt'])[:20]

# 변동비 상세
variable_detail = sorted(
    [{'name': k, 'amt': int(v)} for k, v in detail_by_cat['변동비'].items()],
    key=lambda x: -x['amt']
)[:8]

fixed_detail = sorted(
    [{'name': k, 'amt': int(v)} for k, v in detail_by_cat['고정비'].items()],
    key=lambda x: -x['amt']
)[:8]

data = {
    'total': int(total),
    'monthly_avg': int(total / 12),
    'max_month': max_month,
    'min_month': min_month,
    'cat_totals': {c: int(v) for c, v in cat_totals.items()},
    'monthly_list': monthly_list,
    'payment_methods': {k: int(v) for k, v in methods.items()},
    'top_expenses': top_10,
    'variable_detail': variable_detail,
    'fixed_detail': fixed_detail,
}

print("HTML 대시보드 생성 중...")

html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2022 가계부 대시보드</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {{ font-family: 'Noto Sans KR', sans-serif; }}
    .card {{ background: white; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04); }}
    .chart-container {{ position: relative; }}
    .gradient-bg {{ background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); }}
    .kpi-card {{ transition: transform 0.2s; }}
    .kpi-card:hover {{ transform: translateY(-2px); }}
    ::-webkit-scrollbar {{ width: 6px; height: 6px; }}
    ::-webkit-scrollbar-track {{ background: #f1f5f9; }}
    ::-webkit-scrollbar-thumb {{ background: #cbd5e1; border-radius: 3px; }}
  </style>
  <script>
    const DATA = {json.dumps(data, ensure_ascii=False)};
  </script>
</head>
<body class="bg-slate-50 min-h-screen">

  <!-- Header -->
  <header class="gradient-bg text-white py-8 px-6 mb-8 shadow-lg">
    <div class="max-w-7xl mx-auto">
      <p class="text-blue-200 text-sm font-medium tracking-wider mb-1">HOUSEHOLD LEDGER</p>
      <h1 class="text-3xl font-bold">2022 가계부 대시보드</h1>
      <p class="text-blue-200 mt-1 text-sm">2022년 1월 ~ 12월 지출 분석</p>
    </div>
  </header>

  <div class="max-w-7xl mx-auto px-4 pb-12">

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="card kpi-card p-5">
        <p class="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">연간 총 지출</p>
        <p class="text-2xl font-bold text-slate-800" id="kpi-total"></p>
        <p class="text-xs text-slate-400 mt-1">2022년 전체</p>
      </div>
      <div class="card kpi-card p-5">
        <p class="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">월 평균 지출</p>
        <p class="text-2xl font-bold text-blue-600" id="kpi-avg"></p>
        <p class="text-xs text-slate-400 mt-1">12개월 평균</p>
      </div>
      <div class="card kpi-card p-5">
        <p class="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">최대 지출 월</p>
        <p class="text-2xl font-bold text-red-500" id="kpi-max-month"></p>
        <p class="text-xs text-slate-400 mt-1" id="kpi-max-amt"></p>
      </div>
      <div class="card kpi-card p-5">
        <p class="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">대출상환 비율</p>
        <p class="text-2xl font-bold text-orange-500" id="kpi-debt-ratio"></p>
        <p class="text-xs text-slate-400 mt-1" id="kpi-debt-amt"></p>
      </div>
    </div>

    <!-- Charts Row 1: 월별 지출 (넓게) -->
    <div class="card p-6 mb-6">
      <h2 class="text-base font-semibold text-slate-700 mb-4">월별 지출 현황 (분류별 누적)</h2>
      <div class="chart-container" style="height: 300px;">
        <canvas id="monthlyStackedChart"></canvas>
      </div>
    </div>

    <!-- Charts Row 2: 분류별 도넛 + 결제수단 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="card p-6">
        <h2 class="text-base font-semibold text-slate-700 mb-4">분류별 지출 비율</h2>
        <div class="chart-container" style="height: 260px;">
          <canvas id="categoryDonutChart"></canvas>
        </div>
      </div>
      <div class="card p-6">
        <h2 class="text-base font-semibold text-slate-700 mb-4">결제수단별 비율</h2>
        <div class="chart-container" style="height: 260px;">
          <canvas id="paymentChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Charts Row 3: 월별 트렌드 + 변동비 상세 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="card p-6">
        <h2 class="text-base font-semibold text-slate-700 mb-4">월별 순수 생활비 트렌드</h2>
        <p class="text-xs text-slate-400 mb-3">대출상환 제외 (고정비 + 변동비 + 여행공연비)</p>
        <div class="chart-container" style="height: 220px;">
          <canvas id="trendLineChart"></canvas>
        </div>
      </div>
      <div class="card p-6">
        <h2 class="text-base font-semibold text-slate-700 mb-4">변동비 항목별 현황</h2>
        <div class="chart-container" style="height: 240px;">
          <canvas id="variableBarChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Table: 상위 지출 내역 -->
    <div class="card p-6">
      <h2 class="text-base font-semibold text-slate-700 mb-4">주요 지출 내역 TOP 20</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100">
              <th class="text-left py-2 px-3 text-xs text-slate-400 font-medium">날짜</th>
              <th class="text-left py-2 px-3 text-xs text-slate-400 font-medium">분류</th>
              <th class="text-left py-2 px-3 text-xs text-slate-400 font-medium">내역</th>
              <th class="text-left py-2 px-3 text-xs text-slate-400 font-medium">결제수단</th>
              <th class="text-right py-2 px-3 text-xs text-slate-400 font-medium">금액</th>
            </tr>
          </thead>
          <tbody id="expenseTable"></tbody>
        </table>
      </div>
    </div>

  </div>

  <script>
    // ── 유틸 ──────────────────────────────────────────────────────────────────
    function won(n) {{
      return (n >= 10000)
        ? (n % 10000 === 0
          ? Math.floor(n/10000).toLocaleString() + '만원'
          : Math.floor(n/10000).toLocaleString() + '.' + String(Math.floor((n%10000)/1000)) + '만원')
        : n.toLocaleString() + '원';
    }}
    function wonFull(n) {{ return n.toLocaleString() + '원'; }}

    const CAT_COLORS = {{
      '고정비':   '#3B82F6',
      '대출상환': '#EF4444',
      '변동비':   '#10B981',
      '여행공연비': '#F59E0B',
    }};
    const CATS = ['고정비', '대출상환', '변동비', '여행공연비'];

    // ── KPI ──────────────────────────────────────────────────────────────────
    document.getElementById('kpi-total').textContent = won(DATA.total);
    document.getElementById('kpi-avg').textContent = won(DATA.monthly_avg);
    document.getElementById('kpi-max-month').textContent = DATA.max_month.month;
    document.getElementById('kpi-max-amt').textContent = wonFull(DATA.max_month.total);
    const debtRatio = (DATA.cat_totals['대출상환'] / DATA.total * 100).toFixed(1) + '%';
    document.getElementById('kpi-debt-ratio').textContent = debtRatio;
    document.getElementById('kpi-debt-amt').textContent = wonFull(DATA.cat_totals['대출상환']);

    // ── 월별 스택 막대 ────────────────────────────────────────────────────────
    new Chart(document.getElementById('monthlyStackedChart'), {{
      type: 'bar',
      data: {{
        labels: DATA.monthly_list.map(d => d.month),
        datasets: CATS.map(c => ({{
          label: c,
          data: DATA.monthly_list.map(d => d[c]),
          backgroundColor: CAT_COLORS[c],
          borderRadius: 3,
          borderSkipped: false,
        }}))
      }},
      options: {{
        responsive: true, maintainAspectRatio: false,
        plugins: {{
          legend: {{ position: 'top', labels: {{ font: {{ size: 12 }}, padding: 16 }} }},
          tooltip: {{
            callbacks: {{
              label: ctx => ` ${{ctx.dataset.label}}: ${{ctx.parsed.y.toLocaleString()}}원`
            }}
          }}
        }},
        scales: {{
          x: {{ stacked: true, grid: {{ display: false }} }},
          y: {{
            stacked: true,
            grid: {{ color: '#f1f5f9' }},
            ticks: {{
              callback: v => v >= 1000000 ? (v/10000).toFixed(0) + '만' : v
            }}
          }}
        }}
      }}
    }});

    // ── 분류별 도넛 ──────────────────────────────────────────────────────────
    new Chart(document.getElementById('categoryDonutChart'), {{
      type: 'doughnut',
      data: {{
        labels: CATS,
        datasets: [{{
          data: CATS.map(c => DATA.cat_totals[c] || 0),
          backgroundColor: CATS.map(c => CAT_COLORS[c]),
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 8
        }}]
      }},
      options: {{
        responsive: true, maintainAspectRatio: false,
        cutout: '60%',
        plugins: {{
          legend: {{ position: 'right', labels: {{ font: {{ size: 12 }}, padding: 12 }} }},
          tooltip: {{
            callbacks: {{
              label: ctx => ` ${{ctx.label}}: ${{ctx.parsed.toLocaleString()}}원 (${{(ctx.parsed/DATA.total*100).toFixed(1)}}%)`
            }}
          }}
        }}
      }}
    }});

    // ── 결제수단 파이 ─────────────────────────────────────────────────────────
    const pmKeys = Object.keys(DATA.payment_methods);
    const pmVals = pmKeys.map(k => DATA.payment_methods[k]);
    new Chart(document.getElementById('paymentChart'), {{
      type: 'doughnut',
      data: {{
        labels: pmKeys,
        datasets: [{{
          data: pmVals,
          backgroundColor: ['#6366F1', '#EC4899', '#14B8A6', '#F97316'],
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 8
        }}]
      }},
      options: {{
        responsive: true, maintainAspectRatio: false,
        cutout: '60%',
        plugins: {{
          legend: {{ position: 'right', labels: {{ font: {{ size: 12 }}, padding: 12 }} }},
          tooltip: {{
            callbacks: {{
              label: ctx => ` ${{ctx.label}}: ${{ctx.parsed.toLocaleString()}}원 (${{(ctx.parsed/(pmVals.reduce((a,b)=>a+b,0))*100).toFixed(1)}}%)`
            }}
          }}
        }}
      }}
    }});

    // ── 월별 트렌드 (대출 제외) ───────────────────────────────────────────────
    const livingCosts = DATA.monthly_list.map(d => d['고정비'] + d['변동비'] + d['여행공연비']);
    new Chart(document.getElementById('trendLineChart'), {{
      type: 'line',
      data: {{
        labels: DATA.monthly_list.map(d => d.month),
        datasets: [{{
          label: '생활비',
          data: livingCosts,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#3B82F6',
          pointRadius: 4,
          tension: 0.35,
          fill: true
        }}]
      }},
      options: {{
        responsive: true, maintainAspectRatio: false,
        plugins: {{
          legend: {{ display: false }},
          tooltip: {{
            callbacks: {{
              label: ctx => ` 생활비: ${{ctx.parsed.y.toLocaleString()}}원`
            }}
          }}
        }},
        scales: {{
          x: {{ grid: {{ display: false }} }},
          y: {{
            grid: {{ color: '#f1f5f9' }},
            ticks: {{ callback: v => (v/10000).toFixed(0) + '만' }}
          }}
        }}
      }}
    }});

    // ── 변동비 항목별 막대 ────────────────────────────────────────────────────
    new Chart(document.getElementById('variableBarChart'), {{
      type: 'bar',
      data: {{
        labels: DATA.variable_detail.map(d => d.name.length > 8 ? d.name.slice(0,8)+'…' : d.name),
        datasets: [{{
          label: '변동비',
          data: DATA.variable_detail.map(d => d.amt),
          backgroundColor: 'rgba(16,185,129,0.8)',
          borderRadius: 6,
        }}]
      }},
      options: {{
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {{
          legend: {{ display: false }},
          tooltip: {{
            callbacks: {{
              label: ctx => ` ${{ctx.parsed.x.toLocaleString()}}원`
            }}
          }}
        }},
        scales: {{
          x: {{
            grid: {{ color: '#f1f5f9' }},
            ticks: {{ callback: v => (v/10000).toFixed(0)+'만' }}
          }},
          y: {{ grid: {{ display: false }} }}
        }}
      }}
    }});

    // ── 지출 테이블 ──────────────────────────────────────────────────────────
    const CAT_BADGE = {{
      '고정비':   'bg-blue-100 text-blue-700',
      '대출상환': 'bg-red-100 text-red-700',
      '변동비':   'bg-emerald-100 text-emerald-700',
      '여행공연비': 'bg-amber-100 text-amber-700',
    }};
    const tbody = document.getElementById('expenseTable');
    DATA.top_expenses.forEach((e, i) => {{
      const badge = CAT_BADGE[e.cat] || 'bg-slate-100 text-slate-600';
      const row = `
        <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
          <td class="py-2.5 px-3 text-slate-500">${{e.date}}</td>
          <td class="py-2.5 px-3">
            <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${{badge}}">${{e.cat}}</span>
          </td>
          <td class="py-2.5 px-3 text-slate-700">${{e.detail}}</td>
          <td class="py-2.5 px-3 text-slate-500">${{e.method}}</td>
          <td class="py-2.5 px-3 text-right font-semibold text-slate-800">${{e.amt.toLocaleString()}}원</td>
        </tr>`;
      tbody.insertAdjacentHTML('beforeend', row);
    }});
  </script>
</body>
</html>"""

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f"index.html 생성 완료!")
print(f"   총 지출: {total:,.0f}원")
print(f"   월별 데이터: {len(monthly_list)}개월")
