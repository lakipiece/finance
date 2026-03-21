import openpyxl
from collections import defaultdict
import warnings
warnings.filterwarnings('ignore')

wb = openpyxl.load_workbook('data/2022 가계부.xlsx', data_only=True)
ws = wb['지출내역']

monthly = defaultdict(lambda: defaultdict(float))
methods = defaultdict(float)
expenses = []

for row in ws.iter_rows(min_row=2, values_only=True):
    m = row[2]
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
    if hasattr(m, 'month'):
        mn = m.month
    else:
        continue

    monthly[mn][str(cat)] += amt
    if method:
        methods[str(method)] += amt
    expenses.append((amt, mn, str(cat), str(detail) if detail else ''))

total = sum(v for d in monthly.values() for v in d.values())

f = open('_analysis.txt', 'w', encoding='utf-8')
f.write(f'총 지출: {total:,.0f}원\n\n')
f.write('월별 분류별:\n')
for mn in sorted(monthly):
    f.write(f'  {mn}월: ')
    for cat, v in sorted(monthly[mn].items()):
        f.write(f'{cat}={v:,.0f}  ')
    f.write('\n')
f.write('\n결제수단:\n')
for k, v in sorted(methods.items(), key=lambda x: -x[1]):
    f.write(f'  {k}: {v:,.0f}원\n')
f.write('\nTop 10 지출:\n')
for amt, mn, cat, detail in sorted(expenses, reverse=True)[:10]:
    f.write(f'  {mn}월 [{cat}] {detail} = {amt:,.0f}원\n')
f.close()
print('분석 완료')
