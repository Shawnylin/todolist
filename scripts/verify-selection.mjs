import { chromium } from 'playwright-core';
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:960}});
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button',{name:'开始使用'}).click();
await page.locator('[role="dialog"]').waitFor({state:'detached'});
const rounds = await page.evaluate(async () => {
  const group = document.querySelector('.week-days'), buttons = group.querySelectorAll('button');
  const sleep = ms => new Promise(r => setTimeout(r,ms));
  const out = [];
  for(let i=0;i<12;i++) {
    buttons[0].click(); await sleep(500);
    const indicator = group.querySelector('.selection-indicator');
    buttons[6].click(); await sleep(30 + i*7); buttons[0].click(); await sleep(550);
    out.push({round:i,delta:indicator.getBoundingClientRect().x-buttons[0].getBoundingClientRect().x,count:group.querySelectorAll('.selection-indicator').length,opacity:getComputedStyle(indicator).opacity});
  }
  return out;
});
console.log(JSON.stringify(rounds));
if(rounds.some(r => Math.abs(r.delta)>1 || r.count!==1 || r.opacity!=='1')) throw new Error('retarget failed');
const routeCheck = await page.evaluate(async () => {
  const buttons = document.querySelectorAll('.nav-item');
  const sleep = ms => new Promise(r => setTimeout(r,ms));
  buttons[1].click(); await sleep(45); buttons[2].click(); await sleep(45); buttons[0].click(); await sleep(750);
  return { pages: document.querySelectorAll('.main-inner').length, view: location.hash, calendar: !!document.querySelector('.week-strip'), opacity: getComputedStyle(document.querySelector('.main-inner')).opacity };
});
if(routeCheck.pages!==1 || routeCheck.view!=='#/today' || !routeCheck.calendar || routeCheck.opacity!=='1') throw new Error(JSON.stringify(routeCheck));
await page.locator('.sidebar').getByRole('button',{name:'设置',exact:true}).click();
await page.getByRole('button',{name:'深色',exact:true}).waitFor();
await page.waitForTimeout(400);
await page.getByRole('button',{name:'深色',exact:true}).click();
await page.waitForTimeout(450);
const themeCheck = await page.locator('.segmented').evaluate(el => ({ delta: Math.abs(el.querySelector('.selection-indicator').getBoundingClientRect().x-el.querySelector('.seg-btn.active').getBoundingClientRect().x), count: el.querySelectorAll('.selection-indicator').length }));
if(themeCheck.delta>1 || themeCheck.count!==1) throw new Error(JSON.stringify(themeCheck));
await page.locator('.sidebar').getByRole('button',{name:'今天',exact:true}).click();
await page.getByRole('button',{name:'添加早上的任务'}).waitFor();
await page.waitForTimeout(400);
const interrupted = await page.evaluate(async () => {
  document.querySelector('[aria-label="添加早上的任务"]').click();
  await new Promise(r => setTimeout(r,90));
  const panel = document.querySelector('.add-sheet');
  const before = panel.getBoundingClientRect().x;
  panel.querySelector('[aria-label="关闭"]').click();
  await new Promise(requestAnimationFrame);
  const after = panel.getBoundingClientRect().x;
  await new Promise(r => setTimeout(r,100));
  return {before, after, later:panel.getBoundingClientRect().x, mounted:panel.isConnected};
});
if(!interrupted.mounted || interrupted.later<interrupted.after || Math.abs(interrupted.after-interrupted.before)>80) throw new Error(JSON.stringify(interrupted));
console.log(JSON.stringify({routeCheck,themeCheck,interrupted}));
await browser.close();
