import { createServer } from 'node:http';
import { chromium } from 'playwright-core';

const requests = [];
const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173';
let streamFinished = false;
let rejectReasoningOnce = false;

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, cors).end();
    return;
  }
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  requests.push(body);
  if (rejectReasoningOnce && body.reasoning_effort) {
    rejectReasoningOnce = false;
    response.writeHead(400, { ...cors, 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { message: 'Unsupported parameter: reasoning_effort' } }));
    return;
  }
  response.writeHead(200, {
    ...cors,
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
  });
  if (body.messages.at(-1).content.includes('模拟流中断')) {
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"reply":"已生成的部分内容' } }] })}\n\n`,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    response.end();
    return;
  }
  const longReply = Array.from(
    { length: 14 },
    (_, index) => `## 分段 ${index + 1}\n\n这是一段用于验证用户上滑时保持阅读位置的流式内容。`,
  ).join('\n\n');
  const answer = JSON.stringify({
    reply: body.messages.at(-1).content.includes('停止生成')
      ? longReply
      : '# 流式标题\n\n- 第一项\n- 第二项\n\n| 日期 | 任务 |\n| --- | --- |\n| 今天 | 阅读 |\n\n`行内代码`\n\n<script>alert(1)</script>\n\n[安全链接](https://example.com)',
    operations: body.messages.at(-1).content.includes('新增')
      ? [{ type: 'add', fields: { title: '流式新增任务' } }]
      : [],
  });
  for (let index = 0; index < answer.length; index += 7) {
    const content = answer.slice(index, index + 7);
    response.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
  response.write('data: [DONE]\n\n');
  response.end();
  streamFinished = true;
});
await new Promise((resolve) => server.listen(5188, '127.0.0.1', resolve));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true });
const page = await context.newPage();
const checks = [];
const errors = [];
const assert = (value, label) => {
  if (!value) throw new Error(label);
  checks.push(label);
};
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(appUrl);
  if (await page.getByRole('button', { name: '开始使用' }).count()) {
    await page.getByRole('button', { name: '开始使用' }).click();
    await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
  }
  await page.evaluate(async () => {
    const db = await import('/src/db.ts');
    const state = await db.loadAll();
    state.tasks = [];
    state.settings = {
      ...state.settings,
      onboarded: true,
      reasoningEnabled: false,
      reasoningEffort: 'medium',
      aiProfiles: [
        {
          id: 'stream-test',
          name: '流测试',
          apiKey: 'fake-stream-key',
          baseUrl: 'http://127.0.0.1:5188/v1',
          model: 'stream-model',
        },
      ],
      activeAiProfileId: 'stream-test',
    };
    state.conversation = [];
    state.conversations = [];
    state.activeConversationId = undefined;
    await db.saveAll(state);
  });
  await page.reload();
  await page.goto(`${appUrl}/#/plan`);
  const input = page.getByRole('textbox', { name: '发送给计划助手' });
  await input.waitFor();
  streamFinished = false;
  await input.fill('流式新增');
  await input.press('Enter');
  await page.locator('.chat-markdown h1').waitFor();
  assert(!streamFinished, 'Markdown appears before the stream completes');
  assert(
    (await page.evaluate(async () => (await import('/src/db.ts')).loadAll().then((s) => s.tasks)))
      .length === 0,
    'task operations wait for the complete stream',
  );
  await page.getByRole('button', { name: '发送消息' }).waitFor();
  assert(
    (await page.evaluate(async () => (await import('/src/db.ts')).loadAll().then((s) => s.tasks)))
      .some((task) => task.title === '流式新增任务'),
    'validated operations apply after DONE',
  );
  assert((await page.locator('.chat-markdown li').count()) === 2, 'GFM list renders');
  assert((await page.locator('.chat-markdown table').count()) === 1, 'GFM table renders');
  assert((await page.locator('.chat-markdown code').count()) >= 1, 'Markdown code renders');
  assert((await page.locator('.chat-markdown script').count()) === 0, 'raw HTML is not executed');
  assert(!(await page.locator('.chat-markdown').last().innerText()).includes('alert(1)'), 'raw HTML is removed');
  assert(
    (await page.locator('.chat-markdown a').getAttribute('href')) === 'https://example.com',
    'safe Markdown links render',
  );

  rejectReasoningOnce = true;
  await page.getByRole('button', { name: '深度思考' }).click();
  await page.getByRole('button', { name: '高', exact: true }).click();
  const requestCount = requests.length;
  await input.fill('测试深度思考');
  await input.press('Enter');
  await page.getByRole('button', { name: '发送消息' }).waitFor();
  assert(requests.length === requestCount + 2, 'unsupported reasoning retries exactly once');
  assert(requests.at(-2).reasoning_effort === 'high', 'selected reasoning effort is sent');
  assert(!('reasoning_effort' in requests.at(-1)), 'fallback retry omits reasoning effort');
  assert(
    (await page.getByRole('button', { name: '深度思考' }).getAttribute('aria-pressed')) === 'false',
    'unsupported reasoning switches off globally',
  );
  assert(
    await page.getByText('当前服务不支持深度思考，已关闭并自动重试。').isVisible(),
    'reasoning fallback is explained',
  );

  streamFinished = false;
  await input.fill('停止生成');
  await input.press('Enter');
  await page.waitForFunction(() => {
    const element = document.querySelector('.chat-scroll');
    return element && element.scrollHeight - element.clientHeight > 160;
  });
  await page.locator('.chat-scroll').evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(180);
  const awayScroll = await page.locator('.chat-scroll').evaluate((element) => ({
    top: element.scrollTop,
    distanceFromBottom: element.scrollHeight - element.scrollTop - element.clientHeight,
  }));
  assert(
    awayScroll.distanceFromBottom > 80,
    `streaming does not pull the user away from older messages (${awayScroll.top})`,
  );
  await page.getByRole('button', { name: '停止生成' }).click();
  await page.getByText('生成已停止，未执行任务操作').waitFor();
  assert(!streamFinished, 'stop aborts an active stream');
  assert((await page.locator('.chat-markdown').last().innerText()).length > 0, 'stop preserves partial output');

  const taskCountBeforeInterruption = await page.evaluate(async () =>
    (await import('/src/db.ts')).loadAll().then((state) => state.tasks.length),
  );
  await input.fill('模拟流中断');
  await input.press('Enter');
  await page.getByText('生成已中断，未执行任务操作').waitFor();
  assert(
    (await page.locator('.chat-markdown').last().innerText()).includes('已生成的部分内容'),
    'interrupted stream preserves partial output',
  );
  assert(await page.getByRole('button', { name: '重试' }).isVisible(), 'interrupted stream can retry');
  assert(
    (await page.evaluate(async () =>
      (await import('/src/db.ts')).loadAll().then((state) => state.tasks.length),
    )) === taskCountBeforeInterruption,
    'interrupted stream does not apply task operations',
  );

  const geometry = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
    const indicator = document.querySelector('.bottom-nav > .selection-indicator').getBoundingClientRect();
    const content = document
      .querySelector('.bottom-nav-item.active .bottom-nav-content')
      .getBoundingClientRect();
    const composer = document.querySelector('.chat-composer').getBoundingClientRect();
    return {
      navBottom: innerHeight - nav.bottom,
      navHeight: nav.height,
      indicatorWidth: indicator.width,
      indicatorHeight: indicator.height,
      aligned:
        Math.abs(indicator.x - content.x) < 1 && Math.abs(indicator.y - content.y) < 1,
      composerGap: nav.top - composer.bottom,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  assert(geometry.navBottom === 6 && geometry.navHeight === 62, 'mobile navigation sits lower');
  assert(
    geometry.indicatorWidth === 60 && geometry.indicatorHeight === 52 && geometry.aligned,
    'selection capsule is aligned at 60 by 52 pixels',
  );
  assert(geometry.composerGap >= 7 && geometry.composerGap <= 10, 'composer aligns above navigation');
  assert(geometry.overflow <= 0, 'mobile plan has no horizontal overflow');
  assert(errors.length === 0, 'no browser runtime errors');
  await page.screenshot({ path: 'artifacts/streaming-plan-iphone.png', fullPage: true });
  console.log(JSON.stringify({ checks, geometry, errors }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
