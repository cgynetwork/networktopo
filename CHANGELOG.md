# Changelog

Topo 网络拓扑绘制软件所有版本变更记录。

---

## [0.11.0] — 2026-07-01

### Added
- 复制/粘贴节点（Ctrl+C/V），粘贴位置偏移 50px，可重复粘贴
- 快速原地复制选中设备（Ctrl+D），偏移 30px
- 画布右键菜单（粘贴/全选/适应视窗）
- 节点右键菜单新增「复制设备」
- 批量右键菜单新增「复制选中设备」
- 拓扑模板：保存/加载/删除模板（`userData/templates/`）
- 模板导入：通过系统文件对话框导入外部 .topo.json 文件
- 画布搜索（Ctrl+F）：浮动搜索栏，按名称/型号/厂商/描述/IP 检索
- 网格显示/隐藏切换按钮
- 10px 吸附开关按钮
- 节点分组（Ctrl+G）：为选中设备分配分组名，节点底部显示彩色标签
- 取消分组（Ctrl+Shift+G 或右键菜单）
- 工具栏缩放控件（+/-/百分比/适应视窗）
- 底部状态栏（缩放比例、设备/连线计数、快捷键提示）
- PromptDialog 组件（替代 Electron 中不可靠的 `window.prompt()`）

### Fixed
- 多选右键菜单导致 UI 全部消失（CanvasContextMenu 参数解构遗漏 6 个 props）
- 分组功能无视觉反馈（DeviceNode 未渲染 groupName 字段）
- 模板保存无交互提示（window.prompt 在 Electron 中不可靠）
- 右键菜单新增取消分组选项（单节点 + 批量）

---

## [0.10.0] — 2026-07-01

### Added
- 画布框选：`selectionOnDrag`，拖拽矩形选择框选中范围内设备
- 对齐工具（6 种）：左/水平居中/右/顶/垂直居中/底，对齐到 10px 网格
- 分布工具（2 种）：水平等距/垂直等距
- Escape 取消所有选中
- 多选感知 PropertyPanel

### Fixed
- 框选计数偏差：`onSelectionChange` 使用 React Flow callback 参数而非 `nodesRef.current`
- 右键批量删除菜单不出现：React Flow v12 NodesSelection 覆盖层拦截右键事件
- 对齐工具仅生效一次（同轴操作预期行为）

---

## [0.9.3] — 2026-06-30

### Added
- 业务说明提示框：鼠标悬浮设备 3 秒后显示 tooltip
- PC 终端和笔记本终端两个新分类
- 无线连接类型（wireless）：WLAN 端口 + 信号波纹动画
- 数据库增量迁移（预置数据中添加 Lenovo/Dell/HP/Apple 设备）

### Fixed
- 服务器端口布局修复：网络端口从全宽下移改为右侧 NIC 面板

---

## [0.9.2] — 2026-06-30

### Added
- 线缆长度字段：属性面板输入 + 画布线缆标签显示
- 拓扑资产统计面板：工具栏悬浮提示，按型号和连线类型分类统计

### Fixed
- 3 处滑动开关 UI 修复：`overflow-hidden` + translate 位置调整

---

## [0.9.1] — 2026-06-30

### Added
- 端口零基编号：GE0/SFP0 起始可选
- 端口列优先交错编号：多行端口按列优先交替行方向重新编号

---

## [0.9.0] — 2026-06-30

### Added
- 设备堆叠模式：STACK 端口开关 + 专线互连
- STACK 线缆：金色粗线（7px）+ 慢速动画
- 连接校验：STACK ↔ STACK 专线，拒绝 STACK ↔ 非 STACK

---

## [0.8.4] — 2026-06-30

### Fixed
- 连线端点精准修复：`useUpdateNodeInternals` 强制重新测量 Handle 位置
- 带宽标签 SVG 光环：`paintOrder="stroke fill"` 确保文字在任何线缆颜色上清晰可辨

---

## [0.8.3] — 2026-06-30

### Changed
- SVG 元素直接测量替代容器 div 测量
- 带宽标签从 EdgeLabelRenderer HTML 改为 SVG `<text>` 元素
- Handle Position.Top 补偿

---

## [0.8.2] — 2026-06-30

### Fixed
- CSS 类名修正：`.react-flow__edgelabelrenderer` → `.react-flow__edgelabel-renderer`
- 端口标签 `pointerEvents: 'all'`
- 肘形高度负值扩展（-200px）

---

## [0.8.1] — 2026-06-30

### Added
- 端口标签自由拖拽（偏移持久化到 .topo.json）
- 肘形高度范围扩展（10-400px）

### Fixed
- 线缆被设备覆盖：React Flow 层级 z-index 覆写
- 端口标签被覆盖：EdgeLabelRenderer z-index 提升

---

## [0.7.1] — 2026-06-29

### Added
- 端口三级分类（copper/sfp/tenG/QSFP/MGMT）
- 端口顺序编号（GE1/GE2/SFP1/...）
- 模块化端口编辑（网络端口/千兆光纤/万兆光纤三个数字输入）
- 端口实时预览 compose 字符串

### Fixed
- 光纤端口左右分列布局（铜缆左、光纤右）

---

## [0.7.0] — 2026-06-29

### Added
- 增强 SVG 拟真渲染（144px 高度）：渐变机壳、LED 指示灯、前面板端口
- 端口颜色编码（RJ45/SFP/QSFP/MGMT）
- 设备图片上传功能（`userData/device-images/`）
- 组件拆分（DeviceNode/DeviceIllustration/ConnectionHandles/InlineEdit/DeviceImage）
- 属性面板图片预览区

### Changed
- 端口布局算法重写（按宽度填行 + 响应式 SVG 高度）
- 侧边栏右键菜单（修改/删除设备）
- AddDeviceModal 编辑模式

---

## [0.6.0] — 2026-06-29

### Changed
- 类型安全加固：消除全部 `as any`，新增类型别名和安全访问器
- App.tsx 拆分：提取 useHistory/useGifExport/useFileOperations hooks + CanvasContextMenu/ConfirmDialog 组件
- 主进程 IPC 去重

---

## [0.4.5] — 2026-06-29

### Added
- 双主题系统：default（简洁白底蓝调）+ gilded（鎏金暗黑金调）
- CSS 变量驱动主题切换
- ThemeContext（React Context + localStorage 持久化）

---

## [0.4.0] — 2026-06-29

### Added
- 撤销/重做：快照式历史栈（最大 50 步）、拖拽/滑块/尺寸调整防抖
- 最近文件列表（最多 10 条，`userData/recent-files.json`）
- 动态 File 菜单（最近打开的文件区域）
- 自动保存：2 分钟定时器 + 启动恢复对话框
- 工具栏 `•` 未保存标记

---

## [0.2.4] — 2026-06-28

### Changed
- SVG 端口左右分区：网络端口左、光纤端口右
- 16 端口 2×8 规则

---

## [0.2.3] — 2026-06-28

### Added
- 端口选择器下拉菜单
- 端口密度自适应（≤24/12 per row，>24/24 per row）
- 大小端口视觉区分

---

## [0.2.2] — 2026-06-28

### Added
- 动态端口渲染（基于 `ports_info` 字符串解析）
- 连线自动标注端口标签
- 端口解析引擎 `portParser.ts`

---

## [0.2.1] — 2026-06-28

### Added
- 节点底纹颜色自定义
- InlineEdit 移除 label 前缀

---

## [0.2.0] — 2026-06-28

### Added
- 线缆外观 5 项自定义（粗细/颜色/速度/粒子大小/特效颜色）
- 设备节点 6 个文字字段全可双击编辑

---

## [0.1.1] — 2026-06-28

### Added
- 连线连接形式切换（自适应/直线/肘形）
- GIF 导出清晰度提升（Electron capturePage 替代 html-to-image）

### Fixed
- GIF 动画效果丢失（capturePage 捕获实际渲染帧）
- 线缆无法显示（路径函数参数格式修复）
- 方向反转动画异常（交换坐标替代字符串反转）

---

## [0.1.0] — 2026-06-28

### Added
- 右键删除线缆
- 右键删除设备及线缆
- 新建拓扑确认对话框
- GIF 动画导出（20 帧，捕获取帧）
- Visio 风格 SVG 设备插图

### Fixed
- 设备边框仅在悬浮/选中时显示
- 连线无法固定（缺少 Handle type="target"）
- 网线/光纤视觉区分
- GIF 导出无反应（缺少 IPC 处理器）
- GIF worker 加载失败（`base: './'` 修复）

---

## [0.0.1] — 2026-06-28

### Added
- 项目初始化（electron-vite + React 18 + TypeScript + Tailwind CSS）
- React Flow 画布集成
- 三栏布局（Sidebar + Canvas + PropertyPanel）
- SQLite 设备数据库（categories/vendors/device_models）
- 侧边栏动态加载设备
- 拖拽创建节点
- 连线系统（网线/光纤 + 粒子/光带动画）
- .topo.json 保存/打开
- PNG/PDF 导出
- electron-builder 打包配置
