# 技术方案规格

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Electron | ^33.x |
| 构建工具 | Vite (electron-vite) | ^2.x |
| 前端框架 | React | ^18.x |
| 类型系统 | TypeScript | ^5.x |
| 画布引擎 | @xyflow/react (React Flow) | ^12.x |
| 样式方案 | Tailwind CSS | ^3.x |
| 设备数据库 | better-sqlite3 | ^11.x |
| 拓扑文件 | JSON | - |
| 图片导出 | html-to-image | ^1.x |
| PDF 导出 | jsPDF | ^2.x |
| 打包工具 | electron-builder | ^25.x |

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
│   ├── main/                # Electron 主进程
│   │   ├── index.ts         # 主进程入口
│   │   ├── database.ts      # SQLite 数据库管理
│   │   └── ipc.ts           # IPC 通信处理
│   ├── preload/             # 预加载脚本
│   │   └── index.ts
│   └── renderer/            # React 渲染进程
│       ├── App.tsx           # 根组件
│       ├── main.tsx          # 渲染入口
│       ├── components/       # 通用组件
│       │   ├── Sidebar/      # 侧边栏（设备库）
│       │   ├── Canvas/       # 画布组件
│       │   ├── PropertyPanel/ # 属性面板
│       │   └── Toolbar/      # 工具栏
│       ├── store/            # 状态管理
│       ├── types/            # TypeScript 类型定义
│       └── assets/           # 静态资源
├── resources/               # 打包资源（图标等）
├── package.json
├── electron-vite.config.ts  # electron-vite 配置
├── tailwind.config.js       # Tailwind 配置
├── tsconfig.json
└── CLAUDE.md                # Claude 工作指引
```

## 关键依赖说明

### @xyflow/react (React Flow)
- 提供画布核心能力：节点渲染、连线管理、缩放平移
- 支持自定义节点和边组件（Custom Node / Custom Edge）
- 内置拖拽支持（onDragOver / onDrop）
- 官方文档：https://reactflow.dev

### better-sqlite3
- 同步 API，无需处理异步回调
- 适合 Electron 主进程使用
- 通过 IPC 暴露给渲染进程

### electron-vite
- 统一管理 main / preload / renderer 三部分构建
- 开发时热更新支持
