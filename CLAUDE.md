# CLAUDE.md — 网络拓扑绘制软件 (Topo)

## 项目概述
Windows 桌面端网络拓扑绘制工具，Electron + React + TypeScript 构建。

## 文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 需求规格 | [docs/requirements.md](docs/requirements.md) | 功能需求和非功能需求 |
| 技术方案 | [docs/tech-stack.md](docs/tech-stack.md) | 技术栈、依赖、项目结构 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | UI 色彩、布局、字体、交互规范 |
| 执行计划 | [docs/development-plan.md](docs/development-plan.md) | 分阶段开发步骤 |
| 开发日志 | [devlog/](devlog/) | 每日开发记录 |

## 工作指引

### 开发原则
1. **严格按阶段推进**：完成一个 Phase 再进入下一个，不得跳跃
2. **每完成一个子任务**：记录到 `devlog/YYYY-MM-DD.md`
3. **每阶段结束验证**：运行 `npm run start` 确保可启动
4. **遵循设计规范**：UI 改动参考 [docs/design-spec.md](docs/design-spec.md)
5. **先跑通再优化**：功能先可用，再打磨细节

### 技术约束
- 主进程代码：`src/main/` — Node.js 环境，可访问文件系统和 SQLite
- 预加载脚本：`src/preload/` — 桥接层，通过 contextBridge 暴露 API
- 渲染进程：`src/renderer/` — React 应用，浏览器环境
- 数据库操作只能通过 IPC 在主进程执行

### 环境变量注意事项（重要！）
- **VS Code 会设置 `ELECTRON_RUN_AS_NODE=1`**，导致 Electron 以纯 Node.js 模式运行
- 症状：`process.type` 为 `undefined`，`require('electron')` 返回字符串而非 API 对象
- 所有 npm scripts 已自动清除该变量，使用 `npm run dev/build/start` 即可
- 如需手动启动，先执行：`$env:ELECTRON_RUN_AS_NODE=''; $env:ATOM_SHELL_INTERNAL_RUN_AS_NODE=''`

### 常用命令
- **启动应用**：`npm run start`（使用 main.js + 构建后的渲染进程）
- **构建**：`npm run build`（编译 main/preload/renderer）
- **开发模式**：`npm run dev`（electron-vite dev，含 HMR）
- **重建原生模块**：`npm run rebuild`（better-sqlite3 需要匹配 Electron 的 Node.js 版本）
- 注意：`npm run build` 构建的主进程 (out/main/index.js) 存在原生模块打包问题，实际运行使用 `main.js`

### 状态管理
- 使用 React Context + useReducer 管理全局状态
- 设备列表数据通过 IPC 从 SQLite 获取
- 画布节点/连线状态由 React Flow 管理
