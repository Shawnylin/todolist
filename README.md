# 拾光清单 · TidyTodo

一个**移动端优先**的 PWA 待办清单应用,可直接通过 GitHub Pages 部署使用。界面参考 Todoist / Microsoft To Do 等成熟产品,内置 **DeepSeek AI 助手**(可选,用户自带 API Key)。

![License](https://img.shields.io/badge/license-MIT-blue)
![PWA](https://img.shields.io/badge/PWA-ready-6E56CF)

## ✨ 功能特性

应用分为三个页面,职责清晰:

**☀️ 今天 —— 一屏管理当天任务**

- 顶部**周历条**(周日到周六排列),点选任意日期查看/添加当天安排,左右滑动切换周,右上角「回到今天」
- 按 **早上 / 下午 / 晚上** 三个时段分组,每个时段下方直接添加任务(回车确认)
- 完成与撤销都在本页进行:勾选即完成,已完成任务留在原时段(划线置灰),再点一次即撤销
- 未设日期的任务默认归入今天的「未安排」;逾期任务自动归到今天的对应时段
- 左滑删除、右滑完成、删除可撤销

**✨ 计划 —— 一句话生成今日安排**

- 输入一段自然语言(如「首先写言语理解,然后写资料分析,然后写政治理论」或「上午开会,下午写方案,晚上健身」)
- 点击生成:AI(DeepSeek)会把它拆成多个独立任务,并自动分配到早上/下午/晚上;未配置 API Key 时自动降级为本地规则拆分
- 生成后可逐条调整时段、修改标题、删除,最后「添加到今天」一键批量入库

**📊 洞察 —— 看见你的进展**

- 今日完成 / 近 7 天完成 / 总完成率 / 连续打卡天数
- 近 7 天完成柱状图、待办清单分布环形图、优先级分布条
- 「最近完成」与完整的已完成归档(可一键清空)
- 右上角为**设置入口**(AI 配置、清单管理、主题、数据导入导出、快速录入技巧等都在设置中)

**通用能力**

- 🚩 优先级(P1-P3)、标签、备注、子任务(带进度条)、重复规则(每天/工作日/每周/每月/每年/每 N 天)
- 🔍 全局搜索(标题、备注、标签)
- 🌙 浅色 / 深色 / 跟随系统三种主题
- 💾 数据全部保存在本机浏览器(IndexedDB),**完全离线可用**
- 🧩 AI 任务拆解:在任务详情中一键拆成可执行子步骤

**DeepSeek AI 助手(在设置页填入自己的 API Key 后启用,默认模型 `deepseek-v4-flash`)**

**PWA**

- 📲 可安装到手机主屏幕(iOS Safari「添加到主屏幕」/ Android Chrome「安装应用」)
- ⚡ Service Worker 离线缓存,秒开
- 🔔 新版本自动检测并提示更新

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 运行测试
npm test

# 生产构建(输出到 dist/)
npm run build

# 本地预览构建产物
npm run preview
```

## 📦 部署到 GitHub Pages

### 方式一:GitHub Actions 自动部署(推荐)

1. 把本项目推送到你的 GitHub 仓库:

```bash
git init
git add .
git commit -m "init: 拾光清单"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

2. 打开仓库 **Settings → Pages**,在 *Build and deployment* 下:
   - Source 选择 **GitHub Actions**

3. 推送代码后,`.github/workflows/deploy.yml` 会自动构建并部署。完成后访问:

```
https://<你的用户名>.github.io/<仓库名>/
```

### 方式二:gh-pages 分支手动部署

```bash
npm run build
npx gh-pages -d dist
```

然后在 **Settings → Pages** 中选择 `gh-pages` 分支作为发布源。

> 项目构建使用相对路径(`base: './'`),部署在项目子路径下无需任何额外配置。

## 🤖 配置 DeepSeek AI

1. 到 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 创建 API Key
2. 打开应用 → **设置 → AI 助手**,粘贴 Key 并点击「测试连接」
3. 默认使用 `deepseek-chat` 模型;如有需要可修改 API 地址(支持代理)与模型名

**关于浏览器跨域(CORS)**:部分网络环境下浏览器直连 `api.deepseek.com` 可能被拦截。此时可以:

- 在设置中把「API 地址」改为支持 CORS 的第三方代理;
- 或自行部署一个 Cloudflare Worker 反向代理(免费):

```js
// Cloudflare Workers 示例
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.host = 'api.deepseek.com';
    const init = {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    };
    const res = await fetch(url.toString(), init);
    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
```

然后将设置页中的 API 地址改为你的 Worker 域名即可。

**隐私说明**:API Key 仅保存在你自己设备的浏览器中,应用直接向 DeepSeek 发起 HTTPS 请求,不经过任何第三方服务器。

## 💡 快速录入语法

在「今天」页的时段输入框和「计划」页中,支持以下快捷语法(完整技巧见应用内 **设置 → 快速录入技巧**):

| 输入 | 效果 |
| --- | --- |
| `p1 写总结` | 最高优先级 |
| `@健康 每天喝药` | 带标签的重复任务 |
| `！2 洗车` | 优先级 P2 |
| `上午开会,下午写方案,晚上健身` | 自动拆成三个时段的任务(计划页) |
| `首先写言语理解,然后写资料分析,然后写政治理论` | 自动拆成三个任务(计划页) |

## 🛠 技术栈与结构

- React 18 + TypeScript + Vite 5
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)(Workbox)生成 Service Worker
- IndexedDB([idb](https://github.com/jakearchibald/idb))本地持久化
- [lucide-react](https://lucide.dev) 图标
- Vitest 单元测试(自然语言解析、计划拆分、日期/重复逻辑)
- 零后端:纯静态站点,数据不出设备

```
src/
├── ai.ts                  # DeepSeek 客户端(一句话多任务解析 / 任务拆解)
├── db.ts                  # IndexedDB 读写
├── store.tsx              # 全局状态(reducer + 持久化 + 旧数据迁移)
├── utils/
│   ├── parse.ts           # 自然语言解析器(p1 @标签 等)
│   ├── planSplit.ts       # 本地计划拆分(无 AI 时的兜底)
│   ├── slot.ts            # 时段(早上/下午/晚上)逻辑
│   └── date.ts            # 日期/重复计算
└── components/
    ├── TodayView.tsx      # 今天:周历条 + 三时段
    ├── PlanView.tsx       # 计划:一句话 → AI 拆分 → 批量添加
    └── InsightsView.tsx   # 洞察:统计图表 + 已完成归档
scripts/gen-icons.mjs      # 纯 Node 生成 PWA 图标(零依赖)
```

## 📄 License

MIT
