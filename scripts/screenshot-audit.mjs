/**
 * 디자인 감사용 전체 화면 캡처
 * 실행: node scripts/screenshot-audit.mjs [필터]
 *
 * - 최초 1회만 브라우저에서 직접 로그인 → 세션을 AUTH_STATE 에 저장, 이후 재사용
 * - 전체 라우트 데스크톱(1440) 풀페이지 + 주요 라우트 모바일(390) 캡처
 * - 각 페이지의 모달 트리거를 눌러 모달 캡처
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE_URL = process.env.BASE_URL ?? 'https://fin.lakipiece.com'
const OUT_DIR = process.env.OUT_DIR ?? path.resolve('screenshots/audit')
const AUTH_STATE = process.env.AUTH_STATE ?? path.resolve('.auth-state.json')

const FILTER = process.argv[2] ?? null

// label, path, mobile 캡처 여부
const ALL_PAGES = [
  ['01_dashboard',          '/',                            true],
  ['02_monthly',            '/monthly',                     true],
  ['03_compare',            '/compare',                     false],
  ['04_expenses',           '/expenses',                    true],
  ['05_expenses_input',     '/expenses/input',              true],
  ['06_income',             '/income',                      false],
  ['07_incomes_input',      '/incomes/input',               false],
  ['08_budget',             '/budget',                      false],
  ['09_assets',             '/assets',                      false],
  ['10_energy',             '/energy',                      false],
  ['11_input',              '/input',                       false],
  ['12_options',            '/options',                     false],
  ['13_settings',           '/settings',                    false],
  ['14_admin',              '/admin',                       false],
  ['20_portfolio',          '/portfolio',                   true],
  ['21_pf_holdings',        '/portfolio/holdings',          true],
  ['22_pf_accounts',        '/portfolio/accounts',          false],
  ['23_pf_securities',      '/portfolio/securities',        false],
  ['24_pf_prices',          '/portfolio/securities/prices', false],
  ['25_pf_snapshots',       '/portfolio/snapshots',         false],
  ['26_pf_snapshot_charts', '/portfolio/snapshots/charts',  false],
  ['27_pf_rebalance',       '/portfolio/rebalance',         true],
  ['28_pf_income',          '/portfolio/income',            false],
  ['29_pf_options',         '/portfolio/options',           false],
  ['30_pf_settings',        '/portfolio/settings',          false],
]

const PAGES = FILTER
  ? ALL_PAGES.filter(([label, p]) => label.includes(FILTER) || p.includes(FILTER))
  : ALL_PAGES

const SKIP_BUTTON_TEXT =
  /로그아웃|logout|sign out|delete|삭제|확인|cancel|취소|닫기|close|저장|save|submit|제출|수집|가져오|불러|동기화|실행|새로고침/i

const MODAL_SELECTORS = [
  '[role="dialog"]', '[class*="modal"]', '[class*="Modal"]',
  '[class*="dialog"]', '[class*="Dialog"]', '[class*="overlay"]', '[class*="Overlay"]',
]

async function isModalVisible(page) {
  for (const sel of MODAL_SELECTORS) {
    if (await page.locator(sel).first().isVisible().catch(() => false)) return sel
  }
  const hasOverlay = await page.evaluate(() => {
    for (const el of document.querySelectorAll('body > *, body > * > *')) {
      const s = getComputedStyle(el)
      if (
        s.position === 'fixed' && parseInt(s.zIndex || '0') > 40 &&
        s.display !== 'none' && s.visibility !== 'hidden' &&
        el.getBoundingClientRect().width > window.innerWidth * 0.5
      ) return true
    }
    return false
  }).catch(() => false)
  return hasOverlay ? 'fixed-overlay' : null
}

async function closeModal(page) {
  for (const sel of ['button[aria-label="Close"]', 'button[aria-label="닫기"]', '[class*="modal-close"]']) {
    const el = page.locator(sel).first()
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {})
      await page.waitForTimeout(350)
      if (!(await isModalVisible(page))) return
    }
  }
  for (const txt of ['취소', 'Cancel', '닫기', 'Close']) {
    const el = page.getByRole('button', { name: txt }).first()
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {})
      await page.waitForTimeout(350)
      if (!(await isModalVisible(page))) return
    }
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(350)
}

async function forceCloseAll(page, url) {
  for (let i = 0; i < 4; i++) {
    if (!(await isModalVisible(page))) return
    await closeModal(page)
  }
  if (await isModalVisible(page)) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(500)
  }
}

async function shoot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' })
  console.log(`  📸 ${name}.png`)
}

async function captureModals(page, label, url) {
  let n = 0
  const seen = new Map()
  let cursor = 0
  while (n < 6) {
    if (await isModalVisible(page)) await forceCloseAll(page, url)
    const btns = await page.locator('button, [role="button"]').all()
    if (cursor >= btns.length) break
    const btn = btns[cursor]
    cursor++
    if (!(await btn.isVisible().catch(() => false))) continue
    const text = ((await btn.textContent().catch(() => '')) ?? '').trim()
    if (SKIP_BUTTON_TEXT.test(text)) continue
    const key = `${text}||${((await btn.evaluate(el => el.outerHTML).catch(() => '')) ?? '').slice(0, 80)}`
    if ((seen.get(key) ?? 0) >= 1) continue

    const before = page.url()
    await btn.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(700)
    if (page.url() !== before) {
      await page.goto(before, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {})
      await page.waitForTimeout(400)
      cursor = 0
      seen.clear()
      continue
    }
    if (await isModalVisible(page)) {
      seen.set(key, 1)
      n++
      const safe = text.replace(/[^a-zA-Z0-9가-힣]/g, '_').slice(0, 24) || `btn${cursor}`
      await shoot(page, `${label}__modal${n}_${safe}`)
      await forceCloseAll(page, url)
    }
  }
  return n
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const hasAuth = fs.existsSync(AUTH_STATE)

  const browser = await chromium.launch({ headless: hasAuth })
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: hasAuth ? AUTH_STATE : undefined,
  })
  const page = await ctx.newPage()

  if (!hasAuth) {
    console.log('\n🔐 브라우저가 열렸습니다. 직접 로그인해 주세요. (최초 1회)\n')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 600_000 })
    await ctx.storageState({ path: AUTH_STATE })
    console.log(`✅ 로그인 세션 저장: ${AUTH_STATE}\n`)
  }

  for (const [label, p] of PAGES) {
    const url = `${BASE_URL}${p}`
    console.log(`\n▶ ${label}  ${p}`)
    try {
      await forceCloseAll(page, url)
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(1200)
      await shoot(page, label)
      const n = await captureModals(page, label, url)
      if (n) console.log(`  └─ 모달 ${n}개`)
    } catch (e) {
      console.warn(`  ⚠️  ${label}: ${e.message}`)
    }
  }

  // 모바일 캡처
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    storageState: AUTH_STATE,
  })
  const mpage = await mctx.newPage()
  for (const [label, p, wantMobile] of PAGES) {
    if (!wantMobile) continue
    try {
      await mpage.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle', timeout: 30000 })
      await mpage.waitForTimeout(1000)
      await shoot(mpage, `m_${label}`)
    } catch (e) {
      console.warn(`  ⚠️  m_${label}: ${e.message}`)
    }
  }

  console.log(`\n✅ 완료 → ${OUT_DIR}\n`)
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
