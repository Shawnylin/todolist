import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const errors = [], requests = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
const assert = (v, text) => { if (!v) throw new Error(text); checks.push(text); };
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button', { name: '开始使用' }).click();
await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
await page.evaluate(async () => {
  const db = await import('/src/db.ts');
  const state = await db.loadAll();
  state.settings = { ...state.settings, onboarded: true, theme: 'light', apiKey: 'test-only-not-a-real-key', baseUrl: 'https://example.test', aiProfiles: undefined, activeAiProfileId: undefined };
  await db.saveAll(state);
});
let slow = false;
await page.route('https://example.test/v1/chat/completions', async route => {
  const body = route.request().postDataJSON(); requests.push(body);
  const text = body.messages.at(-1).content;
  const taskContext = JSON.parse(body.messages[0].content.split('当前上下文（含本地日期和最新任务）如下：')[1]);
  const id = taskContext.tasks.find(t => t.title === '阅读三十分钟')?.id;
  if (text === '网络失败') return route.fulfill({ status: 500, body: '{}' });
  if (text === '慢请求') { slow = true; await new Promise(r => setTimeout(r, 1300)); }
  const reply = text === '明天上午九点阅读三十分钟' ? { reply: '安排好了，明天上午九点阅读三十分钟。', operations: [{ type: 'add', fields: { title: '阅读三十分钟', due: '2026-09-13', dueTime: '09:00', slot: 'morning' } }] }
    : text === '改到晚上八点' ? { reply: '已把阅读移到晚上八点。', operations: [{ type: 'update', id, fields: { slot: 'evening', dueTime: '20:00' } }] }
    : text === '完成阅读' ? { reply: '阅读已完成。', operations: [{ type: 'complete', id, done: true }] }
    : text === '删除阅读' ? { reply: '已删除阅读任务。', operations: [{ type: 'delete', id }] }
    : text === '无效操作' ? { reply: '错误操作', operations: [{ type: 'update', id: 'unknown', fields: { title: '不存在' } }] }
    : { reply: '可以的，你希望怎样安排？', operations: [] };
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }) });
});
await page.reload();
await page.locator('.sidebar').getByRole('button', { name: '计划', exact: true }).click();
await page.getByRole('textbox', { name: '发送给计划助手' }).waitFor();
const send = async text => { await page.getByRole('textbox', { name: '发送给计划助手' }).fill(text); await page.getByRole('button', { name: '发送消息' }).click(); await page.getByRole('button', { name: '发送消息' }).waitFor(); };
const tasks = () => page.evaluate(async () => (await import('/src/db.ts')).loadAll().then(s => s.tasks));
await send('明天上午九点阅读三十分钟');
assert((await tasks()).length === 1, 'chat creates a real task');
await send('改到晚上八点');
assert((await tasks())[0].dueTime === '20:00', 'follow-up updates same task');
assert(requests[1].messages.some(m => m.content === '明天上午九点阅读三十分钟'), 'multi-turn context sent');
await send('完成阅读');
assert((await tasks())[0].done, 'chat completes task');
await page.getByRole('button', { name: '撤销本次操作' }).last().click();
assert(!(await tasks())[0].done, 'completion undo');
await send('删除阅读');
assert((await tasks()).length === 0, 'chat deletes task');
await page.getByRole('button', { name: '撤销本次操作' }).last().click();
assert((await tasks()).length === 1, 'delete undo');
await send('无效操作');
assert((await tasks()).length === 1, 'invalid action leaves tasks intact');
await send('网络失败');
assert(await page.getByRole('button', { name: '重试', exact: true }).count() === 1, 'network retry affordance');
await page.getByRole('textbox', { name: '发送给计划助手' }).fill('慢请求');
await page.getByRole('button', { name: '发送消息' }).click();
await page.getByRole('button', { name: '停止生成' }).click();
await page.waitForTimeout(1500);
assert(slow && (await tasks()).length === 1, 'abort discards late response');
await page.reload();
await page.getByRole('textbox', { name: '发送给计划助手' }).waitFor();
assert(await page.locator('.chat-message').count() > 10, 'conversation persists after reload');
await page.waitForTimeout(450);
await page.screenshot({ path: 'artifacts/chat-desktop.png', fullPage: true });
await page.locator('.sidebar').getByRole('button', { name: '今天', exact: false }).click();
await page.locator('.week-days .selection-indicator').waitFor();
await page.waitForTimeout(500);
const samples = await page.evaluate(async () => {
  const group = document.querySelector('.week-days');
  const buttons = group.querySelectorAll('button');
  buttons[0].click(); await new Promise(r => setTimeout(r, 550));
  const marker = group.querySelector('.selection-indicator');
  const result = [], start = marker.getBoundingClientRect().x;
  buttons[6].click();
  for (let i = 0; i < 12; i++) {
    await new Promise(requestAnimationFrame);
    result.push({ x: marker.getBoundingClientRect().x, opacity: getComputedStyle(marker).opacity, count: group.querySelectorAll('.selection-indicator').length });
    if (i === 6) buttons[0].click();
  }
  await new Promise(r => setTimeout(r, 650));
  return { start, result, final: marker.getBoundingClientRect().x, active: group.querySelector('.week-day.sel')?.getAttribute('aria-label'), target: buttons[0].getAttribute('aria-label'), connected: buttons[0].isConnected, activeX: group.querySelector('.week-day.sel')?.getBoundingClientRect().x, transform: marker.style.transform };
});
assert(samples.result.every(s => s.opacity === '1' && s.count === 1), 'one opaque indicator throughout animation');
assert(samples.result.some(s => s.x > samples.start + 5), 'indicator has intermediate moving frames');
console.log(JSON.stringify({ samples }));
assert(Math.abs(samples.final - samples.start) < 1, 'rapid retarget returns to origin');
await page.getByRole('button', { name: '添加早上的任务' }).click();
await page.locator('.add-sheet').waitFor();
await page.waitForTimeout(400);
const exitSamples = await page.evaluate(async () => {
  const panel = document.querySelector('.add-sheet');
  panel.querySelector('[aria-label="关闭"]').click();
  const frames = [];
  for (let i = 0; i < 8; i++) { await new Promise(requestAnimationFrame); frames.push({ exists: panel.isConnected, x: panel.getBoundingClientRect().x, y: panel.getBoundingClientRect().y }); }
  return frames;
});
assert(exitSamples.every(s => s.exists) && exitSamples.at(-1).x > exitSamples[0].x + 10, 'desktop drawer stays mounted and exits right');
await page.locator('.add-sheet').waitFor({ state: 'detached' });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: '添加早上的任务' }).click();
await page.waitForTimeout(400);
const mobileExit = await page.evaluate(async () => {
  const panel = document.querySelector('.add-sheet'); const start = panel.getBoundingClientRect().y;
  panel.querySelector('[aria-label="关闭"]').click(); await new Promise(r => setTimeout(r, 100));
  return { start, end: panel.getBoundingClientRect().y, mounted: panel.isConnected };
});
assert(mobileExit.mounted && mobileExit.end > mobileExit.start + 10, 'mobile sheet exits downward');
await page.locator('.add-sheet').waitFor({ state: 'detached' });
await page.locator('.bottom-nav').getByRole('button', { name: '计划', exact: true }).click();
await page.getByRole('textbox', { name: '发送给计划助手' }).waitFor();
await page.waitForTimeout(450);
await page.screenshot({ path: 'artifacts/chat-mobile.png', fullPage: true });
assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'chat mobile has no horizontal overflow');
await page.getByRole('button', { name: '查看计划列表' }).click();
await page.getByRole('dialog', { name: '计划列表', exact: true }).waitFor();
await page.getByRole('button', { name: '完成', exact: true }).click();
await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.locator('.bottom-nav').getByRole('button', { name: '今天', exact: true }).click();
await page.getByRole('button', { name: '添加早上的任务' }).click();
await page.locator('.add-sheet').waitFor();
assert(await page.locator('.add-sheet').evaluate(el => getComputedStyle(el).transform === 'none' || new DOMMatrixReadOnly(getComputedStyle(el).transform).m42 === 0), 'reduced-motion sheet is at final position');
await page.keyboard.press('Escape');
await page.locator('.add-sheet').waitFor({ state: 'detached' });
await page.setViewportSize({ width: 320, height: 740 });
await page.locator('.bottom-nav').getByRole('button', { name: '计划', exact: true }).click();
await page.getByRole('textbox', { name: '发送给计划助手' }).waitFor();
assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px chat fits');
assert(errors.length === 0, 'no browser exceptions');
await writeFile('artifacts/chat-motion-results.json', JSON.stringify({ checks, samples, exitSamples, mobileExit, errors }, null, 2));
console.log(JSON.stringify({ checks, errors }));
await browser.close();
