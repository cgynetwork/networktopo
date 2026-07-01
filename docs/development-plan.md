# 开发执行计划

## 阶段划分

### Phase 1: 基础框架 ✅
**目标**：项目骨架跑通，能看到三栏布局和画布
- 1.1 初始化 electron-vite + React + TypeScript 项目
- 1.2 配置 Tailwind CSS 黑白主题
- 1.3 搭建三栏布局（Sidebar + Canvas + PropertyPanel）
- 1.4 集成 React Flow 画布（空画布，支持缩放平移）
- 1.5 工具栏基础按钮（缩放控制）

### Phase 2: 设备库系统 ✅
**目标**：左侧设备库完整可用
- 2.1 SQLite 数据库初始化（主进程）
- 2.2 IPC 通信桥接（渲染 ↔ 主进程）
- 2.3 设备分类侧边栏 UI（折叠/展开）
- 2.4 预置设备数据导入脚本
- 2.5 搜索过滤功能
- 2.6 设备悬浮描述弹窗
- 2.7 设备描述编辑（右键菜单）

### Phase 3: 拖拽与画布操作 ✅
**目标**：能拖设备到画布并操作节点
- 3.1 侧边栏 → 画布拖拽功能
- 3.2 自定义设备节点组件（SVG 图标 + 名称 + 型号）
- 3.3 节点选中、移动、删除
- 3.4 节点标签编辑（双击名称）
- 3.5 节点右键菜单

### Phase 4: 连接线系统 ✅
**目标**：设备间连线 + 流量动画
- 4.1 设备节点连接点（Handle）
- 4.2 连线拖拽创建
- 4.3 连接类型切换（网线/光纤/堆叠/无线）
- 4.4 动画切换（粒子/光带/波纹）
- 4.5 方向箭头与方向反转

### Phase 5: 文件与导出 ✅
**目标**：能保存、打开、导出拓扑图
- 5.1 保存为 .topo.json
- 5.2 打开 .topo.json 文件
- 5.3 最近文件列表
- 5.4 PNG 导出
- 5.5 PDF 导出
- 5.6 GIF 导出（Electron capturePage）

### Phase 6: 打包与交付 （部分完成）
**目标**：生成 Windows 安装包
- 6.1 electron-builder 配置 ✅
- 6.2 Windows 图标和安装程序 （待完成）
- 6.3 功能完整性测试 ✅
- 6.4 Bug 修复 ✅

---

### Phase 7: 功能迭代（V0.4.0 — V0.11.0）✅

**7.1 撤销/重做 + 最近文件 + 自动保存（V0.4.0）**
- 快照式历史栈（最大 50 步）、拖拽/滑块/尺寸调整防抖
- 最近文件菜单（最多 10 条，userData/recent-files.json）
- 2 分钟自动保存定时器 + 启动恢复对话框

**7.2 双主题系统（V0.4.5）**
- default（简洁白底蓝调）+ gilded（鎏金暗黑金调）
- CSS 变量驱动，ThemeContext + localStorage 持久化

**7.3 类型安全加固 + 代码重构（V0.6.0）**
- 消除 `as any`，新增 TopoNode/TopoEdge 类型别名 + 安全访问器
- App.tsx 拆分为 hooks（useHistory/useGifExport/useFileOperations）+ 组件（CanvasContextMenu/ConfirmDialog）
- 主进程 IPC 去重

**7.4 拟真设备渲染 + 图片上传（V0.7.0）**
- 增强 SVG 插图（144px 高度，渐变机壳、LED 指示灯、端口颜色编码）
- 设备图片上传（userData/device-images/）
- 组件拆分（DeviceNode/DeviceIllustration/ConnectionHandles/InlineEdit/DeviceImage）

**7.5 端口布局算法 + 模块化编辑（V0.7.1）**
- 按宽度填行布局算法 + 响应式 SVG 高度
- 三级端口分类（copper/sfp/tenG）+ 左右分列布局
- 模块化端口编辑（三个数字输入） + 顺序编号
- 端口编号选项（零基/交错）

**7.6 线缆层级 + 端口标签拖拽 + 精准定位（V0.8.1 — V0.8.4）**
- React Flow 边层/标签层 z-index 覆写
- 端口标签自由拖拽（偏移持久化）
- useUpdateNodeInternals 强制重新测量 Handle 位置
- SVG 文本光环确保带宽标签可读性

**7.7 设备堆叠（V0.9.0）**
- STACK 端口开关 + 专线互连 + 金色线缆

**7.8 端口编号 + 线缆长度 + 资产统计（V0.9.1 — V0.9.2）**
- 零基编号 + 列优先交错
- 线缆长度标注 + 拓扑资产统计面板

**7.9 业务备注 + 终端设备 + 无线连接（V0.9.3）**
- 业务说明 tooltip（3 秒悬浮）
- PC/笔记本终端分类
- 无线连接类型 + 信号波纹动画
- 数据库增量迁移

**7.10 多选 + 对齐/分布（V0.10.0）**
- 框选（selectionOnDrag）+ Shift+Click
- 6 对齐 + 2 分布工具，吸附 10px 网格
- 多选感知 PropertyPanel

**7.11 用户体验打磨（V0.11.0）**
- 复制粘贴（Ctrl+C/V/D）+ 画布右键菜单
- 拓扑模板（保存/加载/删除/导入）
- 画布搜索（Ctrl+F）
- 网格/吸附切换
- 节点分组（Ctrl+G/Ctrl+Shift+G）
- 缩放控件 + 状态栏
- PromptDialog 组件

---

### Phase 8: V1.0.0 正式发布 ← 当前阶段
**目标**：文档同步、打包完善、发布 V1.0.0
- 8.1 更新所有项目文档（requirements/tech-stack/design-spec/development-plan）
- 8.2 新建 CHANGELOG.md + RELEASE_NOTES.md
- 8.3 创建 Windows 应用图标
- 8.4 清理旧构建产物，验证最终打包
- 8.5 全功能完整性测试
- 8.6 版本号升级 → V1.0.0
- 8.7 Git 提交 + v1.0.0 tag

## 开发原则

1. **小步推进**：每完成一个子任务就记录进度
2. **及时验证**：每阶段结束后运行 `npm run dev` 验证
3. **日志先行**：在 devlog/ 记录每日完成和待办
4. **先跑通再优化**：功能先可用，再打磨细节
