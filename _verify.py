import json

with open('index.html', encoding='utf-8') as f:
    content = f.read()

start = content.find('const DATA = ') + 13
end = content.find(';\n  </script>', start)
data = json.loads(content[start:end])

print('총 지출:', f"{data['total']:,}원")
print('월 평균:', f"{data['monthly_avg']:,}원")
print('최대 지출월:', data['max_month']['month'], f"{data['max_month']['total']:,}원")
print('분류별:')
for k, v in data['cat_totals'].items():
    print(f'  {k}: {v:,}원')
print('결제수단:', data['payment_methods'])
print('변동비 상세:', [d['name'] for d in data['variable_detail']])
print('TOP5 지출:')
for e in data['top_expenses'][:5]:
    print(f"  {e['date']} [{e['cat']}] {e['detail']} = {e['amt']:,}원")
