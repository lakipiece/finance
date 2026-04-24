import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

console.log('\n🌐 로그인해 주세요...\n');
await page.goto('https://fin.lakipiece.com/login');
await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 300_000 });
console.log('✅ 로그인 확인\n');

await page.goto('https://fin.lakipiece.com/portfolio/income', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1000);

// "+ 배당 추가" 버튼 클릭
const btn = page.getByText('+ 배당 추가', { exact: false }).first();
await btn.waitFor({ state: 'visible', timeout: 5000 });
await btn.click();
await page.waitForTimeout(800);

const out = path.join(OUT_DIR, '15_portfolio_income__modal_dividend_add.png');
await page.screenshot({ path: out, fullPage: true });
console.log(`📸 저장됨: ${out}`);

await browser.close();
