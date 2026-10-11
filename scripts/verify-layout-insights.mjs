import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [], checks = [], layouts = [];
page.on('pageerror', (error) => errors.push(error.message));
const check = (condition, label) => { assert(condition, label); checks.push(label); };
const closeSheet = async () => {
  await page.locator('.insight-task-sheet').getByRole('button', { name: '关闭', exact: true }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
};
const navigate = async (route) => {
  const label = { today: '一周安排', plan: '计划', insights: '洞察', settings: '设置' }[route];
  await page.goto(`http://127.0.0.1:5173/#/${route}`);
  await page.getByRole('heading', { name: label, exact: true }).waitFor();
};

try {
  await navigate('today');
  await page.getByRole('button', { name: '开始使用', exact: true }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
  await navigate('insights');
  check(await page.locator('.empty-title').innerText() === '暂无任务', 'empty insights has one concise state');
  check(await page.locator('.insight-bars').count() === 0, 'empty insights omits empty charts');

  await page.evaluate(async () => {
    const db = await import('/src/db.ts');
    const { todayISO, addDaysISO, parseISODate } = await import('/src/utils/date.ts');
    const state = await db.loadAll(), today = todayISO();
    let serial = 0;
    const make = (title, patch = {}) => ({
      id: `layout-${serial++}`, title, notes: '', listId: 'inbox', priority: 0,
      tags: [], subtasks: [], done: false, createdAt: 1, slot: 'morning', ...patch,
    });
    const done = (date, title) => make(title, { done: true, completedAt: parseISODate(date).getTime() + 3600000 * 12 });
    const tasks = [];
    [1, 2, 0, 3, 1, 0, 2].forEach((count, i) => {
      for (let j = 0; j < count; j++) tasks.push(done(addDaysISO(today, i - 6), `已完成 ${i}-${j}`));
    });
    for (let i = 7; i < 14; i++) tasks.push(done(addDaysISO(today, -i), `前期完成 ${i}`));
    tasks.push(done(addDaysISO(today, -29), '三十天边界完成'));
    tasks.push(make('导入的完成任务', { done: true }));
    tasks.push(done(addDaysISO(today, 1), '未来时间戳'));
    tasks.push(make('逾期重点', { due: addDaysISO(today, -2), priority: 1 }));
    tasks.push(make('逾期普通', { due: addDaysISO(today, -1), slot: 'afternoon' }));
    tasks.push(make('未安排重点', { priority: 1, slot: undefined }));
    tasks.push(make('未安排普通', { slot: undefined }));
    for (let i = 0; i < 3; i++) tasks.push(make(`今日安排 ${i}`, { due: today, slot: ['morning', 'afternoon', 'evening'][i] }));
    for (let i = 0; i < 2; i++) tasks.push(make(`明日安排 ${i}`, { due: addDaysISO(today, 1) }));
    tasks.push(make('七天边界安排', { due: addDaysISO(today, 6) }));
    tasks.push(make('七天之后重点', { due: addDaysISO(today, 7), priority: 1 }));
    state.tasks = tasks;
    state.settings = { ...state.settings, onboarded: true, theme: 'light' };
    await db.saveAll(state);
  });
  await page.reload();
  await page.locator('.insight-summary').waitFor();
  check(await page.locator('.insight-summary-main strong').textContent() === '9件', 'seven-day total excludes older and future completions');
  check(await page.locator('.insight-comparison strong').textContent() === '+2件', 'comparison uses preceding seven days');
  check(await page.getByRole('button', { name: '逾期 2 件', exact: true }).count() === 1, 'overdue total');
  check(await page.getByRole('button', { name: '未安排 2 件', exact: true }).count() === 1, 'undated total');
  check(await page.getByRole('button', { name: 'P1 待办 3 件', exact: true }).count() === 1, 'priority total');
  check(await page.getByRole('region', { name: '未来七天安排' }).locator('.chart-card-title > span').innerText() === '6 件待办', 'forecast includes today through day six');

  for (const [name, count] of [['逾期 2 件', 2], ['未安排 2 件', 2], ['P1 待办 3 件', 3], ['查看近 7 天完成任务', 9]]) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.locator('.insight-task-sheet').waitFor();
    check(await page.locator('.insight-task-sheet .task-row').count() === count, `${name} opens matching tasks`);
    await page.keyboard.press('Shift+Tab');
    check(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')), `${name} traps focus`);
    await closeSheet();
  }
  await page.getByRole('region', { name: '完成趋势' }).getByRole('button', { name: '今天完成 2 件', exact: true }).click();
  await page.locator('.insight-task-sheet').waitFor();
  check(await page.locator('.insight-task-sheet .task-row').count() === 2, 'completion bar opens its day');
  await page.keyboard.press('Escape');
  await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
  await page.getByRole('region', { name: '未来七天安排' }).getByRole('button', { name: '明天待办 2 件', exact: true }).click();
  await page.locator('.insight-task-sheet').waitFor();
  check(await page.locator('.insight-task-sheet .task-row').count() === 2, 'forecast bar opens scheduled tasks');
  await closeSheet();
  await page.getByRole('button', { name: '30 天', exact: true }).click();
  check(await page.locator('.insight-summary-main strong').textContent() === '17件', 'thirty-day total includes boundary');
  check(await page.getByRole('region', { name: '完成趋势' }).locator('.insight-bar').count() === 6, 'thirty-day chart has six tappable intervals');
  const bucketCount = Number(await page.getByRole('region', { name: '完成趋势' }).locator('.insight-bar').first().locator('.insight-bar-value').innerText());
  await page.getByRole('region', { name: '完成趋势' }).locator('.insight-bar').first().click();
  await page.locator('.insight-task-sheet').waitFor();
  check(await page.locator('.insight-task-sheet .task-row').count() === bucketCount, 'thirty-day bar opens its exact interval');
  await closeSheet();
  await page.locator('.insight-recent').getByRole('button', { name: '全部', exact: true }).click();
  await page.locator('.insight-task-sheet').waitFor();
  check(await page.locator('.insight-task-sheet .task-row').count() === 19, 'archive retains tasks without completion dates');
  check(await page.getByText('日期未记录', { exact: true }).count() === 1, 'archive does not invent completion dates');
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await page.getByRole('dialog', { name: '清空已完成任务？', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: '清空已完成任务？', exact: true }).waitFor({ state: 'detached' });
  check(await page.locator('.insight-task-sheet .task-row').count() === 19, 'cancelling clear preserves archive and sheet');
  await closeSheet();
  await page.getByRole('button', { name: '逾期 2 件', exact: true }).click();
  await page.locator('.insight-task-sheet .task-title').first().click();
  await page.locator('.detail-title').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: /^日期/ }).click();
  await page.getByRole('button', { name: '明天', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
  check(await page.getByRole('button', { name: '逾期 1 件', exact: true }).count() === 1, 'editing an insight task updates risk counts');

  // Check edge alignment and navigation geometry, not implementation-specific markup.
  for (const width of [320, 390, 600, 768, 960, 1200, 1440]) {
    await page.setViewportSize({ width, height: width < 960 ? 844 : 1000 });
    for (const theme of ['light', 'dark']) {
      await navigate('settings');
      await page.getByRole('button', { name: theme === 'light' ? '浅色' : '深色', exact: true }).click();
      const edges = [];
      for (const route of ['today', 'plan', 'insights', 'settings']) {
        await navigate(route);
        const layout = await page.evaluate((route) => {
          const box = (selector) => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
          const content = box('.main-inner');
          const first = box({ today: '.week-strip', plan: '.chat-workspace', insights: '.insight-summary', settings: '.settings-card' }[route]);
          const heading = box('h1');
          const css = getComputedStyle(document.querySelector('.main-inner'));
          const out = { route, content, first, heading, gutter: Number.parseFloat(css.paddingLeft), topInset: Number.parseFloat(css.paddingTop), overflow: document.documentElement.scrollWidth > innerWidth, titleSize: getComputedStyle(document.querySelector('h1')).fontSize };
          if (route === 'plan') out.composer = box('.chat-composer');
          if (route === 'today') {
            out.search = box('.schedule-search'); out.all = box('.day-filters button.active'); out.toolbar = box('.day-toolbar');
            out.filterEdges = [...document.querySelectorAll('.day-filters > button')].map((el) => ({ y: el.getBoundingClientRect().y, height: el.getBoundingClientRect().height }));
          }
          if (route === 'settings') {
            out.themeLabels = [...document.querySelectorAll('.seg-btn')].map((el) => ({ height: el.getBoundingClientRect().height, text: el.textContent }));
          }
          if (innerWidth < 960) {
            const nav = box('.bottom-nav'), indicator = box('.bottom-nav > .selection-indicator');
            out.nav = { nav, indicator, active: box('.bottom-nav-item.active .bottom-nav-content'), outerRadius: Number.parseFloat(getComputedStyle(document.querySelector('.bottom-nav')).borderRadius), innerRadius: Number.parseFloat(getComputedStyle(document.querySelector('.bottom-nav > .selection-indicator')).borderRadius) };
          }
          return out;
        }, route);
        check(!layout.overflow, `${width} ${theme} ${route}: no overflow`);
        check(Math.abs(layout.first.x - layout.heading.x) < 1, `${width} ${theme} ${route}: heading aligns to content`);
        check(Math.abs(layout.first.x - layout.content.x - layout.gutter) < 1, `${width} ${theme} ${route}: shared page gutter`);
        edges.push(layout.first.x);
        if (route === 'plan') check(layout.composer.bottom <= (width < 960 ? 844 - 88 : 1000) + 1, `${width} ${theme}: composer clears navigation`);
        if (route === 'today') {
          check(layout.search.right <= layout.all.x + 1 && Math.abs(layout.search.y - layout.all.y) < 1, `${width} ${theme}: search precedes filters on one baseline`);
          check(layout.filterEdges.every((b) => Math.abs(b.y - layout.filterEdges[0].y) < 1 && Math.abs(b.height - layout.filterEdges[0].height) < 1), `${width} ${theme}: equal filter heights`);
          check(await page.locator('.week-dot, .today-header').count() === 0, `${width} ${theme}: no redundant today header or dot`);
        }
        if (route === 'settings') {
          check(await page.locator('.settings-page .back-btn').count() === 0, `${width} ${theme}: primary settings has no back button`);
          check(layout.themeLabels.every((label) => label.height === 44), `${width} ${theme}: theme labels stay on one line`);
        }
        if (route === 'insights') check(await page.locator('.insights-view header').getByRole('button', { name: '设置', exact: true }).count() === 0, `${width} ${theme}: insights has no settings button`);
        if (layout.nav) {
          const { nav, indicator, active, outerRadius, innerRadius } = layout.nav;
          check(layout.topInset === 8, `${width} ${theme} ${route}: compact page top`);
          check(Math.abs(844 - nav.bottom - 8) < 1, `${width} ${theme} ${route}: compact navigation bottom`);
          check(Math.abs(indicator.x - active.x) < 1 && Math.abs(indicator.width - active.width) < 1 && Math.abs(indicator.y - active.y) < 1, `${width} ${theme} ${route}: indicator matches selected item`);
          check(Math.abs(indicator.y - nav.y - (nav.bottom - indicator.bottom)) < 1, `${width} ${theme} ${route}: equal vertical nav insets`);
          check(Math.abs(outerRadius - innerRadius - (indicator.y - nav.y)) < 1, `${width} ${theme} ${route}: concentric nav corners`);
          if (route === 'today' || route === 'settings') check(Math.abs((route === 'today' ? indicator.x - nav.x : nav.right - indicator.right) - (indicator.y - nav.y)) < 1, `${width} ${theme} ${route}: matching horizontal and vertical nav insets`);
        }
        layouts.push({ width, theme, ...layout });
        if (width === 390 || width === 1440) await page.screenshot({ path: `artifacts/aligned-${route}-${width}-${theme}.png`, fullPage: true });
      }
      check(edges.every((x) => Math.abs(x - edges[0]) < 1), `${width} ${theme}: all page left edges match`);
    }
  }
  // Emulate a home-indicator inset: the capsule's own inner space also protects labels.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['today', 'plan', 'insights', 'settings']) {
    await navigate(route);
    await page.evaluate(() => document.documentElement.style.setProperty('--mobile-safe-bottom', '34px'));
    const layout = await page.evaluate(() => {
      const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
      const labelBottom = Math.max(...[...document.querySelectorAll('.bottom-nav-label')].map((label) => label.getBoundingClientRect().bottom));
      const composer = document.querySelector('.chat-composer')?.getBoundingClientRect();
      return { bottomGap: innerHeight - nav.bottom, labelGap: innerHeight - labelBottom, composerGap: composer ? nav.top - composer.bottom : null };
    });
    check(Math.abs(layout.bottomGap - 22) < 1, `${route}: home-indicator space is not reserved twice`);
    check(layout.labelGap >= 34, `${route}: navigation labels clear the home indicator`);
    if (route === 'plan') check(Math.abs(layout.composerGap - 16) < 1, 'home-indicator plan composer clears navigation');
    if (route === 'today') await page.screenshot({ path: 'artifacts/compact-today-home-indicator.png' });
  }
  check(errors.length === 0, 'no browser runtime errors');
  await writeFile('artifacts/layout-insights-report.json', JSON.stringify({ checks, errors, layouts }, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, widths: [320, 390, 600, 768, 960, 1200, 1440], themes: ['light', 'dark'], errors }));
} finally {
  await browser.close();
}
