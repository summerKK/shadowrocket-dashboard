# 🤖 Agent Guide & Maintenance Handbook (AGENT.md)

本文档面向后续接手此项目的 AI Agent、协作开发者及自动化运维工具，系统说明本项目的架构设计、核心机制、常用操作命令以及如何触发 GitHub Actions 云端打包与发布。

---

## 🏗 1. 项目架构概览

本项目是一个专为 **Shadowrocket (小火箭)** 打造的现代化实时网络连接与流量诊断看板，采用极简、高性能、全内嵌的单体架构设计：

```text
shadowrocket-dashboard/
├── .github/
│   └── workflows/
│       └── release.yml        # GitHub Actions 自动化多架构 macOS DMG 打包与 Release 发布
├── build/
│   ├── icon.icns              # macOS 格式原生应用图标
│   ├── icon.png               # 512x512 高清应用图标
│   └── icon.html              # 应用图标原始矢量渲染模板
├── docs/
│   └── images/                # README 示例图例与 Shadowrocket 设置说明截图
├── public/
│   └── index.html             # 单页响应式前端（5款主题、表格/终端/图表三视图、指纹库、详情抽屉）
├── electron-main.mjs          # macOS 原生 Electron 窗口入口（沉浸式磨砂窗口、生命周期、内置服务管理）
├── server.mjs                 # 轻量 Node.js 后端（零第三方运行时依赖，SSE 广播、探针与静态托管）
├── package.json               # 依赖管理、构建配置与打包元数据
└── README.md                  # 用户使用说明文档
```

---

## 🧩 2. 核心模块与实现细节

### 2.1 后端服务 (`server.mjs`)
- **零运行时依赖**：完全基于 Node.js 原生标准库（`node:http`, `node:fs/promises`, `node:url`, `node:path`）。
- **可导入/可直接执行**：
  - `startServer(port)`: 启动服务并返回 `{ server, port }`，供 Electron 或命令行调用。
  - `stopServer()`: 优雅终止长连接与服务。
- **关键路由**：
  - `GET /events`: SSE (Server-Sent Events) 长连接，向下游网页/桌面客户端广播流式日志与状态。
  - `POST /api/test`: 在 2.5 秒超时内主动探测 Shadowrocket 端口并精确返回握手耗时 (`ms`)。
  - `GET / POST /api/config`: 动态获取与修改 Shadowrocket API 上游端点地址并触发热重连。
  - `GET /*`: 静态资源托管与 MIME 类型映射。
- **重连与容错机制**：
  - 采用 `AbortController` 并在断线后以 1 秒为间隔积极重试，确保 Shadowrocket 重启后秒级恢复。

### 2.2 前端界面 (`public/index.html`)
- **主题系统**：基于 CSS 变量 `[data-theme="..."]` 实现 5 套主题（`aurora`、`tokyo-night`、`cyberpunk`、`oled`、`nordic-light`），按 <kbd>T</kbd> 快捷轮换并持久化至 `localStorage`。
- **智能服务与指纹库 (`DOMAIN_APP_MAP`)**：
  - 即使在未开启 MITM 的纯 TCP/TLS 流量下，也能根据目标域名/规则自动识别为 30+ 常见应用徽章（如 ChatGPT, Claude, GitHub, Telegram, YouTube 等）。
- **macOS 安全边距检测**：
  - `<head>` 中注入了即时环境识别脚本，在 Electron 环境下为 `.app-header` 添加 `96px` 左侧留白，避免红黄绿交通灯与 Logo 冲突。
- **内存安全**：采用 LRU 环形淘汰，连接上限固定为 1,000 条，终端屏幕限制在 500 行以内。

### 2.3 Electron 桌面集成 (`electron-main.mjs`)
- **macOS 沉浸式窗口**：
  - `titleBarStyle: 'hiddenInset'` + `trafficLightPosition: { x: 18, y: 18 }`
  - `vibrancy: 'under-window'`（跟随 macOS 系统的暗黑毛玻璃半透明效果）。
- **生命周期集成**：
  - 启动时自动调用 `startServer(8787)`；如遇端口占用自动回退至随机可用端口，并挂载窗口。
  - 应用退出时触发 `stopServer()` 释放资源。

---

## 🛠 3. 常用开发与构建命令

```bash
# 安装开发与打包依赖
npm install

# ----------------------------
# 1. 本地运行模式
# ----------------------------
npm start              # 以 Web 服务模式启动 (浏览器访问 http://127.0.0.1:8787)
npm run app            # 以 macOS 原生桌面应用模式直接启动预览

# ----------------------------
# 2. 本地一键打包 macOS 客户端
# ----------------------------
npm run dist:mac             # 打包默认架构的 DMG 与 APP (输出到 dist/)
npm run dist:mac:arm64       # 针对 Apple Silicon (M1/M2/M3/M4) 打包
npm run dist:mac:x64         # 针对 Intel 架构打包
npm run dist:mac:universal   # 构建通用双架构包
```

---

## 🚀 4. GitHub Actions 云端打包与发布指南

项目已配置好自动化 CI/CD 流水线 [`.github/workflows/release.yml`](.github/workflows/release.yml)。

### 方式 A：推送新版本 Tag 自动打包发布（最常用）

只需新建一个符合 `v*` 规则的 Git Tag 并推送到远程，GitHub Actions 会在 `macos-latest` 上自动编译 ARM64 与 x64 版本的 DMG，并在 Releases 页面自动生成下载链接：

```bash
# 1. 提交所有变更
git add .
git commit -m "feat: your update message"
git push origin main

# 2. 创建并推送新版本标签 (如 v1.0.2)
git tag v1.0.2
git push origin v1.0.2
```

### 方式 B：使用 `gh` 命令行工具一键触发云端打包

无需打 Tag 即可手动触发 Actions 构建：

```bash
# 手动触发 Release Build 工作流
gh workflow run "Release Build"

# 查看云端构建进度
gh run list

# 查看已发布的 Release 列表
gh release list
```

---

## ⚠️ 5. 接手与二次开发注意事项

1. **保持零外部运行时依赖原则**：
   - 请勿在 `dependencies` 中添加大型第三方后端库（如 express/koa/socket.io 等），保持 `server.mjs` 纯原生 Node.js 以维持极轻启动与极致性能。
2. **前后端接口规范**：
   - 任何新增的 API 路由，必须在 `public/index.html` 请求处做好 `contentType.includes('application/json')` 容错处理，防止旧进程未重启时引发 JSON 语法解析崩溃。
3. **样式与主题兼容**：
   - 新增组件或卡片样式时，优先使用 `var(--bg-card)`、`var(--text-primary)` 等 CSS 自定义变量，确保在 5 套皮肤下色彩自适应。
4. **macOS 窗口拖拽区域**：
   - `.app-header` 启用了 `-webkit-app-region: drag`，所有可点击元素（按钮、输入框、下拉框、Tab）必须显式标记 `-webkit-app-region: no-drag`。
