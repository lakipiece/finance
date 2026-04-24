/**
 * fin.lakipiece.com 전체 페이지 + 모달 스크린샷 자동화
 * 실행: node scripts/screenshot-all.mjs
 *
 * 흐름:
 *  1. 브라우저 열기 → 로그인 페이지 이동
 *  2. 사용자가 직접 로그인 (콘솔에 Enter 입력 시 진행)
 *  3. 모든 페이지 순회 → 페이지 스크린샷
 *  4. 각 페이지에서 버튼/트리거 클릭 → 모달 감지 → 모달 스크린샷
 *  5. screenshots/ 폴더에 저장
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://fin.lakipiece.com';
const OUT_DIR = path.resolve('screenshots');

// 순회할 페이지 목록 (경로, 레이블)
// 실행 시 필터: node screenshot-all.mjs portfolio
const PAGE_FILTER = process.argv[2] ?? null;

const ALL_PAGES = [
  { path: '/',                              label: '01_dashboard' },
  { path: '/monthly',                       label: '02_monthly' },
  { path: '/compare',                       label: '03_compare' },
  { path: '/search',                        label: '04_search' },
  { path: '/expenses',                      label: '05_expenses' },
  { path: '/portfolio',                     label: '06_portfolio' },
  { path: '/portfolio/holdings',            label: '07_portfolio_holdings' },
  { path: '/portfolio/accounts',            label: '08_portfolio_accounts' },
  { path: '/portfolio/securities',          label: '09_portfolio_securities' },
  { path: '/portfolio/securities/prices',   label: '10_portfolio_prices' },
  { path: '/portfolio/snapshots',           label: '11_portfolio_snapshots' },
  { path: '/portfolio/snapshots/charts',    label: '12_portfolio_snapshot_charts' },
  { path: '/portfolio/rebalance',           label: '13_portfolio_rebalance' },
  { path: '/portfolio/import',              label: '14_portfolio_import' },
  { path: '/portfolio/income',              label: '15_portfolio_income' },
  { path: '/portfolio/options',             label: '16_portfolio_options' },
  { path: '/portfolio/settings',            label: '17_portfolio_settings' },
  { path: '/settings',                      label: '18_settings' },
  { path: '/admin',                         label: '19_admin' },
];

const PAGES = PAGE_FILTER
  ? ALL_PAGES.filter(p => p.path.includes(PAGE_FILTER) || p.label.includes(PAGE_FILTER))
  : ALL_PAGES;

// 모달로 판단하는 셀렉터 (우선순위 순)
const MODAL_SELECTORS = [
  '[role="dialog"]',
  '[data-state="open"]',
  '.modal',
  '[class*="modal"]',
  '[class*="Modal"]',
  '[class*="dialog"]',
  '[class*="Dialog"]',
  '[class*="sheet"]',
  '[class*="Sheet"]',
  '[class*="overlay"]',
  '[class*="Overlay"]',
];

// 클릭 대상 버튼 셀렉터 (모달 여는 버튼)
const TRIGGER_SELECTORS = [
  'button',
  '[role="button"]',
  'a[href="#"]',
  '[data-modal]',
  '[data-trigger]',
];

// 무시할 버튼 텍스트 패턴 (로그아웃, 삭제 등 위험한 액션)
const SKIP_BUTTON_TEXT = /로그아웃|logout|sign out|delete|삭제|확인|cancel|취소|닫기|close|저장|save|submit|제출/i;

async function waitForLogin(page) {
  console.log('⏳ 로그인을 기다리는 중...');
  // URL이 /login에서 벗어날 때까지 대기 (최대 5분)
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/login'),
    { timeout: 300_000 }
  );
  console.log('✅ 로그인 확인됨\n');
}

async function isModalVisible(page) {
  // 1) 알려진 셀렉터 먼저
  for (const sel of MODAL_SELECTORS) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) return sel;
  }
  // 2) Tailwind fixed+inset-0 overlay 감지 (z-index > 100 인 fixed 요소)
  //    계좌수정 모달처럼 class명에 modal/dialog가 없는 경우 대응
  const hasOverlay = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const s = window.getComputedStyle(el);
      if (
        s.position === 'fixed' &&
        parseInt(s.zIndex) > 100 &&
        s.display !== 'none' &&
        s.visibility !== 'hidden' &&
        el.getBoundingClientRect().width > window.innerWidth * 0.5
      ) return true;
    }
    return false;
  }).catch(() => false);
  return hasOverlay ? 'fixed-overlay' : null;
}

async function closeModal(page) {
  // 1) X 버튼 (modal.close 클래스)
  for (const sel of [
    'button[aria-label="Close"]',
    'button[aria-label="닫기"]',
    '[class*="modal-close"]',
    '[class*="modalClose"]',
  ]) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(400);
      if (!(await isModalVisible(page))) return;
    }
  }

  // 2) "취소" / "저장안함" 텍스트 버튼 — 수정/추가 모달의 유일한 닫기 수단
  for (const txt of ['취소', '저장안함', 'Cancel', 'Close', '닫기']) {
    const el = page.getByRole('button', { name: txt }).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(400);
      if (!(await isModalVisible(page))) return;
    }
  }

  // 3) Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if (!(await isModalVisible(page))) return;

  // 4) overlay 자체를 클릭 — createPortal로 body에 마운트된 경우
  //    overlay는 fixed inset-0 이므로 모달 content 바깥(좌상단 모서리) 클릭
  const overlay = page.locator('[class*="overlay"], [class*="Overlay"]').first();
  if (await overlay.isVisible().catch(() => false)) {
    const box = await overlay.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + 5, box.y + 5);
      await page.waitForTimeout(400);
      if (!(await isModalVisible(page))) return;
    }
  }

  // 5) 마지막 수단: Escape 한 번 더
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

async function screenshotPage(page, label, suffix = '') {
  const filename = suffix ? `${label}__${suffix}.png` : `${label}.png`;
  const filepath = path.join(OUT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  📸 ${filename}`);
  return filepath;
}

const SAMPLE_LIMIT = 5; // 동일 종류 버튼은 최대 5개만 샘플링

// 버튼 고유 키: 텍스트 + outerHTML 앞부분 조합
async function getButtonKey(btn) {
  const text = (await btn.textContent().catch(() => '')).trim().slice(0, 20);
  const html = (await btn.evaluate(el => el.outerHTML).catch(() => '')).slice(0, 80);
  return `${text}||${html}`;
}

// 남은 모달을 모두 강제로 닫고 페이지 클린 상태로 만들기
async function forceCloseAllModals(page) {
  for (let i = 0; i < 5; i++) {
    if (!(await isModalVisible(page))) return;
    await closeModal(page);
    await page.waitForTimeout(300);
  }
  // 그래도 남아있으면 페이지 자체를 리로드해서 클린 상태로
  if (await isModalVisible(page)) {
    await page.reload({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function captureModalsOnPage(page, pageLabel) {
  let modalCount = 0;
  const seenKeys = new Map();
  let cursor = 0; // 몇 번째 버튼까지 처리했는지

  // 버튼 목록은 매 반복마다 재조회 (stale DOM 방지)
  while (true) {
    // 열린 모달이 있으면 먼저 닫기
    if (await isModalVisible(page)) await forceCloseAllModals(page);

    // 현재 페이지 버튼 목록 재조회
    const allBtns = await page.locator(TRIGGER_SELECTORS.join(', ')).all();
    if (cursor >= allBtns.length) break;

    const btn = allBtns[cursor];
    cursor++;

    if (!(await btn.isVisible().catch(() => false))) continue;
    if (await isModalVisible(page)) continue;

    const text = (await btn.textContent().catch(() => '')).trim();
    if (SKIP_BUTTON_TEXT.test(text)) continue;

    const key = await getButtonKey(btn);
    const count = seenKeys.get(key) ?? 0;
    if (count >= SAMPLE_LIMIT) continue;

    // 클릭 전 현재 URL 기록 (의도치 않은 페이지 이탈 감지)
    const urlBefore = page.url();

    await btn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);

    // 페이지가 바뀌었으면 되돌아오기
    if (page.url() !== urlBefore) {
      console.log(`  ↩  페이지 이탈 감지 → 복귀`);
      await page.goto(urlBefore, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
      cursor = 0; // 버튼 목록 리셋
      seenKeys.clear();
      continue;
    }

    const modalSel = await isModalVisible(page);
    if (modalSel) {
      seenKeys.set(key, count + 1);
      modalCount++;
      const safeName = text.replace(/[^a-zA-Z0-9가-힣]/g, '_').slice(0, 30) || `btn${cursor}`;
      await screenshotPage(page, pageLabel, `modal_${modalCount}_${safeName}`);
      await forceCloseAllModals(page);
    }
  }

  return modalCount;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // 로그인 페이지로 이동
  console.log('\n🌐 브라우저를 열었습니다. 로그인해 주세요.\n');
  await page.goto(`${BASE_URL}/login`);
  await waitForLogin(page);

  // 각 페이지 순회
  for (const { path: pagePath, label } of PAGES) {
    const url = `${BASE_URL}${pagePath}`;
    console.log(`\n▶ ${label}  (${url})`);

    try {
      // 이전 페이지에서 혹시 모달이 남아있으면 강제 닫기 후 이동
      await forceCloseAllModals(page);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(800);

      // 페이지 전체 스크린샷
      await screenshotPage(page, label);

      // 모달 트리거 탐색 및 캡처
      const count = await captureModalsOnPage(page, label);
      if (count > 0) console.log(`  └─ 모달 ${count}개 캡처`);
    } catch (err) {
      console.warn(`  ⚠️  ${label} 오류: ${err.message}`);
      // 오류 발생해도 다음 페이지로 강제 진행
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    }
  }

  console.log(`\n✅ 완료! screenshots/ 폴더에 저장됨: ${OUT_DIR}\n`);
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
