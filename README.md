# 🚀 Shadowrocket Connections Dashboard

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Release](https://img.shields.io/github/v/release/summerKK/shadowrocket-dashboard?style=flat-square&color=indigo)](https://github.com/summerKK/shadowrocket-dashboard/releases)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](#)
[![Zero-Dependencies](https://img.shields.io/badge/Dependencies-0%20External-6366f1?style=flat-square)](#)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20Only-emerald?style=flat-square)](#)

适用于 **Shadowrocket (小火箭)** 的现代化本机实时网络连接与流量诊断看板。通过解析 Shadowrocket 本地日志流 (`/api/log`)，提供直观的 3D 流量地球监控、2D 全球拓扑、应用服务分组、路由分流分析、规则匹配诊断与原始日志控制台。

<p align="center">
  <img src="./docs/images/globe-3d-preview.png" alt="Shadowrocket Connections 3D Polyglobe Traffic Visualizer" width="100%" style="border-radius: 12px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);" />
  <em style="color: #94a3b8; font-size: 13px; margin-top: 8px; display: block;">▲ 3D Polyglobe 实时流量地球与应用服务智能分组面板</em>
</p>

<p align="center">
  <img src="./docs/images/map-2d-preview.png" alt="Shadowrocket Connections 2D World Traffic Map" width="100%" style="border-radius: 12px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);" />
  <em style="color: #94a3b8; font-size: 13px; margin-top: 8px; display: block;">▲ 2D 世界网络连接拓扑展开图</em>
</p>

---

## ✨ 核心特性

- 🌐 **3D Polyglobe 流量地球 & 2D 世界网络地图 (默认首页)**：
  - **3D 交互地球**：默认首页集成 WebGL 3D Polyglobe 引擎，实时呈现光纤激光动态飞线、高频节点呼吸脉冲与声呐光晕；支持地球自转、自由平移缩放、视野平滑复位与全屏沉浸模式。
  - **2D 平面展开图**：一键无缝切换 2D 平面展开视图，高饱和度呈现世界各国流量热度分布与出站路由流向。
  - **多维网络链路拓扑**：支持「🎯 真实目标」「🔀 两跳中继（本机 → 代理入口 → 目标）」「🏢 代理入口」三种维度透视网络拓扑。
  - **请求网站与应用服务智能分组**：将活跃连接按请求网站与应用服务（如 Google / YouTube、Apple 系统服务、Telegram、Web 等）进行聚合展示，实时统计连接数与流量占比，支持搜索过滤与地图联动高亮。
  - **秒级本机定位**：内置本地 IP 高精度定位与 35+ 个主流城市经纬度映射库，启动自动秒定用户所在城市并平滑对焦，杜绝卡顿。
  - **规范地图呈现**：完整呈现中国版图（高亮包含台湾及所有所属岛屿）。
- 🖥️ **macOS 原生桌面质感 (Electron)**：
  - 窗口视口刚性锁定，杜绝网页弹性回弹（Rubber-banding）与滚动晃动。
  - 顶部导航栏永久驻顶，自适应 macOS 红绿灯按钮（🔴🟡🟢）专属安全边距，并支持窗口原生拖拽。
  - 地图操作栏粘性吸顶，向下滚动浏览应用分组时快捷控件随手可用。
  - 3D 地球手势与页面滚动深度解耦，双指缩放地球只缩放地球视角，不影响页面布局。
- ⚡️ **实时流式解析**：基于 SSE (Server-Sent Events) 双向保持连接，无缝捕获并结构化解析 Shadowrocket 诊断日志。
- 📊 **指标概览卡片**：实时统计当前活跃连接数、`PROXY` 代理分流占比、`DIRECT` 直连占比、`REJECT` 拦截计数与每秒日志处理吞吐量 (`msg/s`)。
- 🎛 **四重视图模式**：
  - 🌐 **3D 流量地球 (Traffic Globe View)**：沉浸式 3D Polyglobe 流量地球、2D 拓扑与应用分组。
  - 📋 **连接列表 (Table View)**：以结构化表格展示目标主机、分流路径、命中规则、出站策略/节点、握手耗时 (`Cost`) 与客户端应用识别。
  - 💻 **原始日志流 (Stream Console)**：类终端暗黑控制台，提供语法高亮、自动滚动锁定、行数统计与一键复制功能。
  - 📈 **流量统计图表 (Analytics View)**：直观展示高频访问域名 TOP 10、高频命中规则 TOP 10、出站路由比例与策略组分布。
- 🔍 **多维过滤与即时搜索**：
  - 支持快捷键 `⌘K` / `/` 聚焦搜索目标 URL、域名、规则、策略、UA、连接 ID。
  - 支持按 `PROXY` / `DIRECT` / `REJECT`、连接状态（活跃/已关闭）、策略组进行多重筛选。
  - 点击表格中的任意命中规则，即可一键快速过滤同类规则连接。
- 🎨 **多款高颜值精美皮肤**：内置 **5 款专属主题**（🌌 暗夜极光、🟣 东京之夜 Tokyo Night、⚡️ 赛博霓虹 Cyberpunk、🌑 黑曜纯黑 OLED、☀️ 极简明亮 Clean Light），支持按 <kbd>T</kbd> 快捷轮换或顶部下拉菜单一键切换，偏好自动持久化保存。
- 🔎 **深度详情抽屉 (Inspector)**：点击任意连接可滑出详情面板，查看完整的网络握手指标、目标解析、出站决策链路、客户端 User-Agent 以及该连接的全部原始日志碎片，并支持一键导出 JSON。
- 🔧 **动态 API 地址修改**：支持在客户端直接修改 Shadowrocket API 日志端点（如不同端口或局域网设备 IP），支持一键测试连通性并热重载重连，无需重启服务。
- 🔒 **纯本地只读与零依赖**：全站基于 Node.js 标准库与原生 Web 技术构建，零第三方 npm 依赖，默认仅绑定 `127.0.0.1` 本机环回地址，绝不收集或外发任何网络数据。

---

## 🏁 快速开始

### 🍎 方式 A：以 macOS 原生桌面应用运行与打包 (推荐)

项目内置了 Electron 桌面客户端配置，支持原生毛玻璃磨砂窗口、Dock 图标与独立应用窗口：

```bash
# 安装依赖
npm install

# 1. 直接以 macOS 桌面应用模式启动
npm run app

# 2. 一键打包生成 macOS 安装包 (.dmg 与 .app)
npm run dist:mac:arm64   # Apple Silicon (M1/M2/M3/M4)
npm run dist:mac:x64     # Intel Core
```

打包完成后，安装包将输出至 `dist/` 目录：
- 💿 **`dist/Shadowrocket Dashboard-1.1.0-arm64.dmg`**（双击即可拖拽安装）
- 🚀 **`dist/mac-arm64/Shadowrocket Dashboard.app`**（原生应用包）

> 💡 **macOS 提示“已损坏，无法打开 / 移到废纸篓”？**
> 这是因为开源软件未包含苹果付费开发者证书签名，macOS Gatekeeper 自动添加了下载隔离属性。在终端中执行以下命令即可一键秒开：
> ```bash
> sudo xattr -rd com.apple.quarantine "/Applications/Shadowrocket Dashboard.app"
> ```
> *或者：在访达的「应用程序」中，**按住 Control 键右键点击应用图标**，选择 **「打开」** 并在弹窗中再次点击「打开」即可。*

---

### 🌐 方式 B：以本地 Web 网页服务运行 (零依赖)

```bash
# 启动轻量 HTTP 服务
npm start
```

服务启动后，在浏览器中访问：👉 **http://127.0.0.1:8787**

---

### 2. 修改与配置 Shadowrocket API 地址

- **方法 1（推荐）**：打开网页或桌面应用后，直接点击顶部副标题中的 **「修改」** 按钮或右上角 **⚙️ 设置图标**（或按下快捷键 <kbd>S</kbd>），输入新的 API 地址（如 `http://127.0.0.1:1080/api/log` 或 `http://192.168.1.x:1080/api/log`），点击 **「保存并重连」** 即可。
- **方法 2（环境变量）**：通过环境变量在启动时指定：

```bash
# 指定自定义端口与 API 地址
PORT=9000 SHADOWROCKET_LOG_URL=http://127.0.0.1:1080/api/log npm start
```

---

## ⚙️ Shadowrocket 配置说明

若面板显示 **“未连接 Shadowrocket”** 或无法捕获流量，请按以下步骤开启 Shadowrocket 的诊断日志服务：

1. 打开 **Shadowrocket** 客户端。
2. 进入 **「设置 (Settings)」** → **「诊断 (Diagnostics)」**。
3. 确保开启 **「启用日志记录」** 与 **「允许访问」**（如下图红框所示）。
4. 确认日志服务地址（通常为 `http://127.0.0.1:1080/api/log` 或局域网 IP `http://10.0.0.x:1080/api/log`）。

<p align="center">
  <img src="./docs/images/shadowrocket-settings.png" alt="Shadowrocket 诊断日志设置说明" width="750" style="border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);" />
</p>

> 💡 **关于 HTTPS 完整路径显示说明**：
> - 未开启 HTTPS 解密 (MITM) 时，由于 TLS 握手特性，面板仅能解析出访问的目标域名及端口（例如 `api.github.com:443`）。
> - 若需要查看完整的 HTTP 请求路径（如 `/v1/chat/completions?model=...`），请在 Shadowrocket 中针对对应域名开启 **HTTPS 解密 (MITM)** 并信任相应根证书。

---

## ⌨️ 快捷键支持

### 3D 流量地球与网络拓扑

打开首页「3D 流量地球」，系统会自动通过本地 IP 毫秒级识别本机所在城市（如「📍 中国 · 深圳」）并自动平滑对焦连线起点。地图使用随应用打包的 DB-IP 数据库与 Natural Earth 离线数据，不向任何外部服务泄露访问 IP；数据来源、许可和重建方法见 [data/NOTICE.md](data/NOTICE.md)。

线宽与脉冲频率表示当前筛选中的活跃连接记录密度。只有日志确认已建连且路由已知的端点参与绘制；私网、Fake-IP、未知位置不定位。支持一键在 3D Polyglobe 球体与 2D 平面展开图之间自由切换，并可在底部面板中按请求网站/应用分组联动筛选。

开发验证：`npm test`。地图静态资源与离线地理数据已完整纳入 Electron 打包清单。

| 快捷键 | 功能说明 |
| :--- | :--- |
| <kbd>⌘</kbd> + <kbd>K</kbd> 或 <kbd>/</kbd> | 快速聚焦搜索栏 |
| <kbd>T</kbd> | 快速轮换切换界面皮肤主题 (Theme) |
| <kbd>S</kbd> | 打开 Shadowrocket API 端点配置与测试弹窗 |
| <kbd>Space</kbd> (空格键) | 暂停 / 恢复实时日志流刷新 |
| <kbd>C</kbd> | 清空当前已捕获的连接记录与终端屏幕 |
| <kbd>?</kbd> | 打开快捷键与使用帮助弹窗 |
| <kbd>Esc</kbd> | 关闭连接详情抽屉或帮助弹窗 |

---

## ❓ 常见问题与日志机制 (FAQ)

### Q1: Shadowrocket 的日志会一直累计撑满磁盘吗？
- **不会**。Shadowrocket 客户端内置了**日志轮转与文件大小上限机制 (Log Rotation)**，单个日志文件通常限制在 10MB ~ 50MB 之间。当超出上限或跨周期时，它会自动覆盖并删除最老旧的日志文件，不会无限制占用磁盘。
- 如需手动清理，可在 Shadowrocket 客户端进入 **「设置」→「诊断与日志」**，点击底部的 **「清空日志」**。

### Q2: 本看板长期运行会不会持续占用电脑内存？
- **不会**。看板前端内置了**自动环形淘汰机制 (LRU Memory Pruning)**：
  - 连接记录常驻上限为 **1,000 条**，超出后自动优先淘汰已断开的最早连接。
  - 单条连接的详细追踪日志限制在 **20 条**以内，终端屏幕限制在 **500 行**以内。
  - 随时点击顶部 **「清空」** 按钮或刷新网页即可瞬间归零并释放所有内存。

### Q3: 为什么部分 HTTPS 请求只显示域名而没有完整 URL 路径？
- 这是由于 TLS/HTTPS 加密协议的特性。在未开启中间人解密时，代理软件仅能从 TLS SNI 握手阶段获取访问的域名与端口（如 `api.openai.com:443`）。
- 若需要分析完整的 HTTP 请求路径（如 `/v1/chat/completions`），请在 Shadowrocket 中针对目标域名配置 **HTTPS 解密 (MITM)** 并信任根证书。

---

## 📁 目录结构

```text
shadowrocket-dashboard/
├── package.json          # 项目配置、桌面构建与启动脚本
├── electron-main.mjs     # macOS 原生应用主进程（视口锁定、权限管理、窗口配置）
├── server.mjs            # Node.js 轻量后端（日志代理、SSE 广播、静态服务、本机地理位置解析）
├── geo.mjs               # 本地离线 IP / 国家 / 城市高精度地理定位模块
├── data/                 # 离线 IP 地理数据库（DB-IP & GeoIP）
├── public/
│   ├── index.html        # 现代化单页前端（暗黑界面、原生桌面布局、图表与终端）
│   ├── traffic-map.js    # 3D Polyglobe 地球与 2D 地图核心逻辑、飞线动画与分组
│   ├── traffic-map.css   # 地图引擎、吸顶工具栏、光晕特效与响应式样式
│   └── map/              # 离线 TopoJSON / GeoJSON 地图数据
├── docs/                 # 项目文档与高清预览截图
└── README.md             # 项目说明文档
```

---

## 🔒 隐私与安全性说明

- **完全只读**：本服务仅作为日志流的下游消费者，不会向 Shadowrocket 发送任何控制指令或修改系统代理配置。
- **本地安全绑定**：HTTP 服务与 SSE 流默认严格监听于 `127.0.0.1` 本机环回地址，局域网外不可访问。
- **零外部请求**：界面所有图标、样式与交互均内嵌实现，无需联网加载任何外部 CDN 资源，支持完全离线及内网隔离环境。

---

## 📄 License

MIT License. Feel free to use and customize!
