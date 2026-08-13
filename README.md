# 拾光清单 · TidyTodo

一个**移动端优先**的 PWA 待办清单应用,可直接通过 GitHub Pages 部署使用。界面参考 Todoist / Microsoft To Do 等成熟产品,内置 **DeepSeek AI 助手**(可选,用户自带 API Key)。

![License](https://img.shields.io/badge/license-MIT-blue)
![PWA](https://img.shields.io/badge/PWA-ready-6E56CF)

## ✨ 功能特性

**核心待办能力**

- 📝 自然语言快速录入:`明天下午3点开会 #工作 p1` → 自动识别日期、时间、清单、优先级
- 📅 今天 / 计划(未来日程)/ 收件箱 / 自定义清单 / 已完成 多视图
- 🎨 自定义清单:颜色、图标随心配
- 🚩 优先级(P1-P3)、标签、备注、子任务(带进度条)
- 🔁 重复任务:每天 / 工作日 / 每周 / 每月 / 每年 / 每 N 天自定义
- 🔍 全局搜索(标题、备注、标签)
- 👆 左滑删除、右滑完成、删除可撤销
- 🌙 浅色 / 深色 / 跟随系统三种主题
- 💾 数据全部保存在本机浏览器(IndexedDB),**完全离线可用**

**DeepSeek AI 助手(在设置页填入自己的 API Key 后启用)**

- ✨ AI 智能解析:一句话生成结构化任务
- 🧩 AI 任务拆解:把大任务拆成可执行子步骤
- 🗓️ AI 今日计划:按紧急/重要程度给出执行顺序与优先级建议

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

| 输入 | 效果 |
| --- | --- |
| `今天下午3点开会` | 今天 15:00 到期 |
| `明天 18:30 健身` | 明天 18:30 到期 |
| `下周五交周报` | 排到最近的周五 |
| `买牛奶 #购物 p1` | 归入「购物」清单,最高优先级 |
| `每天8点喝药 @健康` | 每天重复,带标签 |
| `每2周理发` | 每两周重复 |
| `工作日晨会 9:00` | 仅工作日重复 |
| `！2 洗车` | 优先级 P2 |

输入时下方会实时显示解析预览,确认无误后按回车即可。点击输入框右侧 ✨ 还可让 AI 二次解析。

## 🛠 技术栈与结构

- React 18 + TypeScript + Vite 5
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)(Workbox)生成 Service Worker
- IndexedDB([idb](https://github.com/jakearchibald/idb))本地持久化
- [lucide-react](https://lucide.dev) 图标
- Vitest 单元测试(自然语言解析器、日期/重复逻辑)
- 零后端:纯静态站点,数据不出设备

```
src/
├── ai.ts                  # DeepSeek 客户端(解析/拆解/今日计划)
├── db.ts                  # IndexedDB 读写
├── store.tsx              # 全局状态(reducer + 持久化)
├── utils/
│   ├── parse.ts           # 自然语言解析器
│   └── date.ts            # 日期/重复计算
└── components/            # UI 组件
scripts/gen-icons.mjs      # 纯 Node 生成 PWA 图标(零依赖)
```

## 📄 License

MIT
