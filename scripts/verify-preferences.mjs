import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const checks = [],
  errors = [],
  requests = [];
const assert = (value, name) => {
  if (!value) throw new Error(name);
  checks.push(name);
};
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button', { name: '开始使用' }).click();
await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
await page.evaluate(async () => {
  const db = await import('/src/db.ts');
  const s = await db.loadAll();
  s.settings = {
    ...s.settings,
    onboarded: true,
    theme: 'light',
    aiProfiles: [
      {
        id: 'test',
        name: '测试配置',
        apiKey: 'fake-test-key',
        baseUrl: 'https://example.test',
        model: 'test-model',
      },
    ],
    activeAiProfileId: 'test',
  };
  const today = (await import('/src/utils/date.ts')).todayISO();
  s.tasks = [0, 1, 2].map((i) => ({
    id: `test-${i}`,
    title: `动画任务${i}`,
    notes: '',
    listId: s.lists[0].id,
    priority: 0,
    tags: [],
    subtasks: [],
    due: today,
    slot: 'morning',
    done: false,
    createdAt: 100 + i,
  }));
  await db.saveAll(s);
});
await page.route('https://example.test/v1/**', async (route) => {
  if (route.request().url().endsWith('/models'))
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] }),
    });
  requests.push(route.request().postDataJSON());
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      choices: [
        { message: { content: JSON.stringify({ reply: '已收到你的安排。', operations: [] }) } },
      ],
    }),
  });
});
await page.reload();
await page.locator('[data-task-position="test-0"]').waitFor();
await page.waitForTimeout(550);
assert((await page.locator('.day-overview').count()) === 0, 'Today progress card removed');
assert(
  (await page.locator('.today-header .view-subtitle').count()) === 0,
  'Today subtitle removed',
);
assert((await page.locator('.week-strip').boundingBox()).height <= 62, 'compact week calendar');
assert(
  (await page
    .locator('.slot-section .task-row')
    .first()
    .evaluate((n) => getComputedStyle(n).borderRadius)) === '14px',
  'task corner radius follows container inset',
);
const sample = await page.evaluate(async () => {
  const node = document.querySelector('[data-task-position="test-0"]');
  const button = node.querySelector('.check');
  const initial = node.getBoundingClientRect().y;
  button.click();
  const frames = [];
  for (let i = 0; i < 36; i++) {
    await new Promise(requestAnimationFrame);
    frames.push({
      y: node.getBoundingClientRect().y,
      connected: node.isConnected,
      opacity: getComputedStyle(node).opacity,
      stroke: getComputedStyle(node.querySelector('.tick-path')).strokeDashoffset,
      strike: getComputedStyle(node.querySelector('.task-title-text')).backgroundSize,
    });
  }
  return {
    initial,
    frames,
    end: node.getBoundingClientRect().y,
    radius: getComputedStyle(button).borderRadius,
  };
});
assert(sample.end > sample.initial + 40, 'completed task moves to bottom');
assert(
  sample.frames.some((f) => f.y > sample.initial + 2 && f.y < sample.end - 2),
  'task has intermediate movement frames',
);
assert(
  sample.frames.every((f) => f.connected && f.opacity === '1'),
  'task stays mounted and opaque',
);
assert(
  sample.frames.some((f) => parseFloat(f.stroke) > 0 && parseFloat(f.stroke) < 1),
  'check stroke animates',
);
assert(
  sample.frames.some((f) => parseFloat(f.strike) > 0 && parseFloat(f.strike) < 100),
  'strikethrough animates',
);
assert(sample.radius === '8px', 'completed checkbox stays rounded rectangle');
await page.locator('[data-task-position="test-0"] .check').click();
await page.waitForTimeout(600);
assert(
  Math.abs((await page.locator('[data-task-position="test-0"]').boundingBox()).y - sample.initial) <
    1,
  'unchecking returns task to origin',
);
const rapid = await page.evaluate(async () => {
  const node = document.querySelector('[data-task-position="test-0"]');
  node.querySelector('.check').click();
  await new Promise((r) => setTimeout(r, 140));
  const before = node.getBoundingClientRect().y;
  node.querySelector('.check').click();
  await new Promise(requestAnimationFrame);
  const after = node.getBoundingClientRect().y;
  await new Promise((r) => setTimeout(r, 600));
  return { before, after, end: node.getBoundingClientRect().y };
});
assert(
  Math.abs(rapid.after - rapid.before) < 12 && Math.abs(rapid.end - sample.initial) < 1,
  'rapid check reversal is continuous and returns to origin',
);
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.locator('[data-task-position="test-0"] .check').click();
await page.waitForTimeout(100);
assert(
  (await page
    .locator('[data-task-position="test-0"]')
    .evaluate(
      (n) => n.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
    )) === 0,
  'reduced motion suppresses completion animations',
);
await page.locator('[data-task-position="test-0"] .check').click();
await page.emulateMedia({ reducedMotion: 'no-preference' });
const nav = async (name) => {
  await page.locator('.bottom-nav').getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(450);
};
await nav('洞察');
assert((await page.locator('.day-overview').count()) === 1, 'Insights contains progress card');
await page.goto('http://127.0.0.1:5173/#/settings');
await page.locator('.theme-colors').waitFor();
await page.locator('.theme-color').nth(1).click();
await page.reload();
await page.locator('.theme-colors').waitFor();
assert(
  (await page.locator('html').getAttribute('data-accent')) === 'blue',
  'accent persists on reload',
);
const surfaces = [];
for (let i = 0; i < 5; i++) {
  await page.locator('.theme-color').nth(i).click();
  surfaces.push(
    await page
      .locator('html')
      .evaluate((n) => getComputedStyle(n).getPropertyValue('--surface-2').trim()),
  );
}
assert(new Set(surfaces).size === 5, 'every accent has coordinated surface colors');
await page.goto('http://127.0.0.1:5173/#/today');
await page.locator('.week-strip').waitFor();
await page.waitForTimeout(450);
await page.screenshot({ path: 'artifacts/today-amber-iphone.png', fullPage: true });
await page.goto('http://127.0.0.1:5173/#/settings');
await page.locator('.theme-colors').waitFor();
await page.getByRole('button', { name: '深色', exact: true }).click();
assert(
  (await page
    .locator('html')
    .evaluate((n) => getComputedStyle(n).getPropertyValue('--surface-2').trim())) === '#30291e',
  'amber dark surfaces match accent',
);
await page.waitForTimeout(500);
await page.screenshot({ path: 'artifacts/settings-amber-dark.png', fullPage: true });
await page.getByRole('button', { name: '浅色', exact: true }).click();
const row = await page
  .locator('.data-actions .btn')
  .evaluateAll((nodes) =>
    nodes.map((n) => ({ y: n.getBoundingClientRect().y, w: n.getBoundingClientRect().width })),
  );
assert(
  row.length === 3 && row.every((r) => Math.abs(r.y - row[0].y) < 1 && r.w > 70),
  'three data buttons share one iPhone-sized row',
);
assert((await page.locator('.tutorial-body').count()) === 0, 'tutorial collapsed by default');
await page.getByRole('button', { name: /使用教程/ }).click();
await page.locator('.tutorial-body').waitFor();
assert(
  (await page.locator('.tutorial-body').innerText()).includes('快速录入技巧'),
  'tutorial consolidates quick entry',
);
await page.getByRole('button', { name: /使用教程/ }).click();
await page.getByRole('button', { name: /^AI 配置/ }).click();
await page.getByRole('button', { name: '获取模型', exact: true }).click();
await page.getByLabel('选择模型').selectOption('model-b');
await page.getByRole('button', { name: '添加配置', exact: true }).click();
const editor = page.locator('.profile-editor').last();
await editor.getByLabel('配置名称').fill('备用配置');
await editor.getByLabel('API 地址').fill('https://example.test/v1/chat/completions');
await editor.getByLabel('API Key', { exact: true }).fill('second-fake-key');
await editor.getByRole('button', { name: '获取模型', exact: true }).click();
await editor.getByLabel('选择模型').selectOption('model-a');
await page.getByRole('button', { name: '启用 备用配置', exact: true }).click();
await page.screenshot({ path: 'artifacts/settings-iphone.png', fullPage: true });
await nav('计划');
const input = page.getByRole('textbox', { name: '发送给计划助手' });
await input.fill('输入法选词');
const beforeIme = requests.length;
await input.evaluate((n) => {
  n.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  n.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    }),
  );
  n.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
});
assert(requests.length === beforeIme, 'IME confirmation does not send');
await input.fill('第一段历史');
await input.press('Enter');
await page.getByText('已收到你的安排。', { exact: true }).waitFor();
assert(requests.at(-1).model === 'model-a', 'active profile and fetched model used');
assert((await page.locator('.chat-composer').boundingBox()).height < 85, 'compact composer');
assert((await page.locator('.chat-footnote').count()) === 0, 'chat disclosure removed from Plan');
await page.getByRole('button', { name: '新建对话', exact: true }).click();
assert((await page.locator('.chat-message').count()) === 0, 'new conversation is empty');
await input.fill('第二段历史');
await input.press('Shift+Enter');
assert((await input.inputValue()).endsWith('\n'), 'Shift Enter inserts newline');
await input.press('Enter');
await page.getByText('已收到你的安排。', { exact: true }).waitFor();
assert(
  !requests.at(-1).messages.some((m) => m.content === '第一段历史'),
  'new conversation has isolated context',
);
await input.fill('手机换行发送');
await input.evaluate((n) =>
  n.dispatchEvent(
    new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertLineBreak',
    }),
  ),
);
await page.getByText('手机换行发送', { exact: true }).waitFor();
assert(requests.at(-1).messages.at(-1).content === '手机换行发送', 'native mobile linebreak sends');
await page.getByRole('button', { name: '历史对话', exact: true }).click();
await page.locator('.conversation-list button').filter({ hasText: '第一段历史' }).click();
await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
assert(
  (await page.getByText('第一段历史', { exact: true }).count()) > 0,
  'past conversation restores',
);
await page.reload();
await input.waitFor();
assert(
  (await page.locator('.chat-message.user').innerText()) === '第一段历史',
  'active conversation persists',
);
const bar = await page.locator('.bottom-nav').boundingBox();
assert(bar.x >= 15 && bar.y + bar.height < 852, 'floating navigation has edge and bottom gaps');
const activeNavBounds = await page.evaluate(() => {
  const active = document.querySelector('.bottom-nav-item.active');
  const label = active?.querySelector('span');
  const indicator = document.querySelector('.bottom-nav > .selection-indicator');
  if (!active || !label || !indicator) return null;
  const a = active.getBoundingClientRect();
  const l = label.getBoundingClientRect();
  const i = indicator.getBoundingClientRect();
  return {
    indicatorCount: document.querySelectorAll('.bottom-nav > .selection-indicator').length,
    containsLabel: i.left <= l.left && i.right >= l.right && i.top <= l.top && i.bottom >= l.bottom,
    followsItem: Math.abs(i.left - a.left) < 1 && Math.abs(i.width - a.width) < 1,
  };
});
assert(
  activeNavBounds?.indicatorCount === 1 &&
    activeNavBounds.containsLabel,
  'selected navigation capsule encloses icon and label',
);
await page.screenshot({ path: 'artifacts/plan-iphone.png', fullPage: true });
await input.focus();
await page.evaluate(() => {
  Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 500 });
  window.visualViewport.dispatchEvent(new Event('resize'));
});
await page.waitForTimeout(350);
assert(
  (await page.locator('html').getAttribute('data-keyboard-open')) === 'true',
  'keyboard viewport detected',
);
assert(
  (await page.locator('.bottom-nav').evaluate((n) => getComputedStyle(n).visibility)) === 'hidden',
  'keyboard does not lift navigation',
);
const composer = await page.locator('.chat-composer').boundingBox();
assert(composer.y + composer.height <= 501, 'composer stays above keyboard');
await page.screenshot({ path: 'artifacts/plan-keyboard.png' });
await page.evaluate(() => {
  delete window.visualViewport.height;
  window.visualViewport.dispatchEvent(new Event('resize'));
});
await input.blur();
await page.waitForTimeout(350);
assert(await page.locator('.bottom-nav').isVisible(), 'navigation returns after keyboard closes');
assert(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  'no horizontal overflow',
);
assert(errors.length === 0, 'no browser runtime errors');
await writeFile(
  'artifacts/preferences-report.json',
  JSON.stringify({ checks, errors, sample }, null, 2),
);
console.log(JSON.stringify({ checks, errors }, null, 2));
await browser.close();
