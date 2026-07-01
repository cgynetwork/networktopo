# 技术方案规格

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Electron | 31.7.7 (Node 20.18.0, Chrome 126) |
| 构建工具 | Vite (electron-vite) | 2.3.0 |
| 前端框架 | React | 18.3.1 |
| 类型系统 | TypeScript | 5.9.3 |
| 画布引擎 | @xyflow/react (React Flow) | 12.11.1 |
| 样式方案 | Tailwind CSS | 3.4.19 |
| 设备数据库 | better-sqlite3 | 12.11.1 |
| 拓扑文件 | JSON (.topo.json) | - |
| 图片导出 | html-to-image | 1.11.13 |
| PDF 导出 | jsPDF | 4.2.1 |
| GIF 动画 | gif.js | 0.2.0 |
| 打包工具 | electron-builder | 26.15.3 |

## 项目结构

```
Topo/
├── docs/                    # 项目文档
│   ├── requirements.md      # 需求规格
│   ├── tech-stack.md        # 技术方案（本文件）
│   ├── design-spec.md       # 设计规范
│   └── development-plan.md  # 执行计划
├── devlog/                  # 开发日志
│   └── YYYY-MM-DD.md       # 每日开发日志
├── src/
│   ├── main/                # Electron 主进程（TypeScript 源码）
│   │   ├── index.ts         # 主进程入口 + 动态菜单 + IPC 注册
│   │   ├── database/        # SQLite 数据库层
│   │   │   ├── connection.ts
│   │   │   ├── schema.ts
│   │   │   └── seed.ts      # 预置数据 + 增量迁移
│   │   └── ipc/             # IPC 处理器
│   │       ├── device-handlers.ts
│   │       ├── file-handlers.ts
│   │       └── recent-files.ts
│   ├── preload/             # 预加载脚本
│   │   └── index.ts
│   └── renderer/            # React 渲染进程
│       ├── App.tsx           # 根组件
│       ├── main.tsx          # 渲染入口（ThemeProvider + ToastProvider）
│       ├── vite.config.ts    # 渲染器 Vite 配置
│       ├── index.html
│       ├── context/          # React Context
│       │   ├── ThemeContext.tsx
│       │   └── ToastContext.tsx
│       ├── hooks/            # 自定义 Hooks
│       │   ├── useHistory.ts
│       │   ├── useGifExport.ts
│       │   └── useFileOperations.ts
│       ├── types/            # TypeScript 类型定义
│       │   ├── index.ts
│       │   └── electron.d.ts
│       ├── utils/            # 工具函数
│       │   └── portParser.ts # 端口解析、布局、分类
│       ├── styles/           # 样式
│       │   ├── global.css    # CSS 变量 + React Flow 层级覆写
│       │   └── themes.css    # default + gilded 双主题
│       └── components/       # 组件
│           ├── Sidebar/      # 侧边栏（设备库）
│           │   ├── Sidebar.tsx
│           │   └── AddDeviceModal.tsx
│           ├── PropertyPanel/ # 属性面板
│           │   └── PropertyPanel.tsx
│           ├── Toolbar/      # 工具栏
│           │   └── Toolbar.tsx
│           ├── nodes/        # 节点组件
│           │   ├── DeviceNode.tsx
│           │   ├── DeviceIllustration.tsx
│           │   ├── ConnectionHandles.tsx
│           │   ├── InlineEdit.tsx
│           │   └── DeviceImage.tsx
│           ├── edges/        # 连线组件
│           │   └── AnimatedEdge.tsx
│           ├── CanvasContextMenu.tsx   # 画布右键菜单
│           ├── SidebarContextMenu.tsx  # 侧边栏右键菜单
│           ├── ConfirmDialog/         # 确认对话框
│           ├── PromptDialog/          # 文本输入对话框
│           └── Toast/                 # Toast 通知容器
├── main.js                  # 生产主进程入口（独立 CommonJS）
├── resources/               # 打包资源（图标等）
├── package.json
├── electron-vite.config.ts  # electron-vite 配置
├── tailwind.config.js       # Tailwind 配置
├── tsconfig.json
└── CLAUDE.md                # Claude 工作指引
```

## 关键架构决策

### 双入口架构（main.js vs src/main/*.ts）

项目存在两套主进程代码：
- **`main.js`**（CommonJS）— 生产入口。`npm run start` 和 `npm run pack/dist` 使用此文件。
- **`src/main/*.ts`**（TypeScript）— 开发入口。`npm run dev` 使用此文件。

**原因**：electron-vite 使用 rollup 打包主进程 TypeScript 源码，但 rollup 无法正确处理 `better-sqlite3` 的原生 `.node` 模块动态加载。因此 `main.js` 保留独立 CommonJS 实现，手动与 TS 源码同步。

**同步规则**：任何新增的 IPC handler、菜单项、窗口配置变更，需同时在两个文件中更新。

### CSS 变量主题系统

所有颜色通过 CSS 自定义属性（`--color-*`）定义，`<html data-theme="...">` 属性控制主题切换。定义在 `themes.css` 中：
- `:root` — default 主题（简洁白底蓝调）
- `[data-theme="gilded"]` — 鎏金主题（暗黑金调）

组件中使用 `bg-surface`、`text-text-primary` 等 Tailwind 语义类名，自动跟随主题。

### 数据库层

- SQLite 数据库文件：`userData/topo-devices.db`
- 3 张表：`categories`、`vendors`、`device_models`
- WAL 模式 + 外键约束
- 预置 7 个分类、9 个厂商、42+ 设备型号
- 增量迁移：新分类/设备按需 `INSERT OR IGNORE`

## 关键依赖说明

### @xyflow/react (React Flow v12)
- 提供画布核心能力：节点渲染、连线管理、缩放平移
- 支持自定义节点和边组件（Custom Node / Custom Edge）
- 内置框选（`selectionOnDrag`）、右键菜单（`onNodeContextMenu`、`onSelectionContextMenu`、`onPaneContextMenu`）
- `useUpdateNodeInternals` 强制重新测量 Handle DOM 位置（port 连接点）
- `EdgeLabelRenderer` — 端口标签 portal，类名 `.react-flow__edgelabel-renderer`
- 官方文档：https://reactflow.dev

### better-sqlite3
- 同步 API，无需处理异步回调
- 适合 Electron 主进程使用
- 通过 IPC 暴露给渲染进程
- 需要匹配 Electron 的 Node.js 版本（`@electron/rebuild` 或 `electron-builder install-app-deps`）

### electron-vite
- 统一管理 main / preload / renderer 三部分构建
- 开发时热更新支持（仅 TypeScript 源码）
- esbuild 转译 TypeScript（仅剥离类型，不做类型检查）

### gif.js
- 浏览器端 GIF 编码
- Worker 脚本通过 Vite `?url` 导入
- 需要 `base: './'` 确保 Electron `file://` 协议下路径正确

## VS Code 环境注意事项

- VS Code 设置 `ELECTRON_RUN_AS_NODE=1` 导致 Electron 以纯 Node.js 模式运行
- 症状：`process.type` 为 `undefined`，`require('electron')` 返回字符串而非 API 对象
- 所有 npm scripts 已自动清除该变量
