# Changelog

Topo 网络拓扑绘制软件所有版本变更记录。

---

## [1.6.0] — 2026-07-08

### Added
- **中英文界面切换**：工具栏新增语言切换按钮（`中`/`EN`），点击可在中文和英文之间切换所有 UI 文本
  - 菜单栏（文件/编辑/查看/帮助）同步切换
  - 工具栏按钮、侧边栏、属性面板、状态栏、右键菜单、对话框、Toast 通知全部翻译
  - 节点内联编辑、错误边界等组件同步切换
  - 语言偏好持久化（localStorage）
  - 使用 react-i18next + i18next 实现，约 460 个翻译键
- **使用指导手册**：新增 `docs/user-manual.md`，涵盖 20 个章节的完整操作指南
  - 界面概览、快速入门、设备管理、画布操作、连线系统、机柜系统
  - 属性面板详解、文件管理、模板系统、导出功能、分组、搜索
  - 主题与语言切换、键盘快捷键速查表、右键菜单速查、常见问题与技巧

### Changed
- `package.json` 新增 `postbuild` 脚本：构建后自动复制 i18n JSON 文件到 `out/` 目录
- 版本号统一升级至 V1.6.0（package.json / 窗口标题 / 工具栏）

---

## [1.5.0] — 2026-07-08

### Fixed
- **导出功能完全重写**：修复三轮迭代积累的坐标错位 bug
  - PNG/PDF/GIF 导出现在正确捕捉拓扑内容（而非空白/偏移区域）
  - 移除 `zoomFactor` 操作，消除渲染进程与主进程间的坐标系统不一致
  - 自动裁剪画布空白区域，仅保留拓扑内容（含 24px 内边距）
  - 导出仅含画布内容，工具栏/侧边栏/状态栏等 UI 元素不会出现
  - ReactFlow 叠加层（MiniMap/Controls/Background）通过 CSS class 在截取时隐藏
  - 导出后画布视图自动恢复到导出前状态

### Changed
- `capture:canvas` IPC handler 简化：渲染进程传入 rect，主进程直接 `capturePage`（不改变 zoomFactor）
- 移除 `gif:boostZoom` / `gif:restoreZoom` IPC handlers
- 版本号统一升级至 V1.5.0（package.json / 窗口标题 / 工具栏）

---

## [1.2.1] — 2026-07-03

### Added
- **业务图片多图上传**：(V1.4.0) 互联网应用支持上传多张业务图片（`appImages[]`），每张独立缩放（0.15×-3×）和自由拖拽定位
- **合并国内外互联网应用**：(V1.4.0) 国内/国际互联网应用统一底盘，ClipPath 裁剪超出机箱部分
- **业务图片缩放把手 hover 显隐**：(V1.5.1) CSS `opacity` 过渡动画，鼠标悬浮图片时显示把手，移开隐藏
- **连线接口 IP 配置**：(V1.5.1) 属性面板新增"🌐 接口 IP"区域，配置后在画布以斜体标签展示（本端绿/对端紫），支持独立拖拽
- **SDWAN CPE Tunnel 端口数量可编辑**：(V1.5.1) 属性面板新增 ± 按钮调节隧道端口数量（1-8），SVG 自适应缩放+多行布局

### Changed
- AP 无线接入点端口默认居中（匹配机箱居中布局）

### Fixed
- 业务图片在机箱内只能左移/上移的钳制问题，改为比例边界允许自由定位

### Security
- 旧 `appImage` 单图字段自动迁移为 `appImages[0]` 数组，向后兼容

---

## [1.3.0] — 2026-07-03

### Added
- **SDWAN 新增两种互联网应用设备类型**：
  - **国内互联网应用**：红/金中国风配色，微信+百度图标，CP-LEFT/CP-RIGHT 接入点
  - **国际互联网应用**：紫/蓝国际化配色，OpenAI+Salesforce 图标，CP-LEFT/CP-RIGHT 接入点
- **SDWAN CPE 隧道端口**：NetEngine AR8140 新增按需启用的隧道端口（TUN-1/TUN-2）
  - 属性面板中"🔷 隧道端口"开关（仅 SDWAN 有端口设备可见）
  - 隧道端口只能连接至 SDWAN Node 的 CP-LEFT/CP-RIGHT 句柄
  - 隧道线缆自动识别为 `connectionType: 'tunnel'`（6px/青色/step 路径）
  - 与堆叠模式共存时自动上移避免重叠
- 新增 `ConnectionType: 'tunnel'` 类型，含专属 CSS 变量和 AnimatedEdge 渲染
- 新增 6 组 CSS 变量（国内/国际主题色 + 隧道端口/线缆色，双主题）

### Changed
- `getSdwanSvgType()` 和 `getSdwanAccent()` 使用 `===` 精确匹配新设备型号，避免与 `includes('互联网')` 冲突

---

## [1.2.0] — 2026-07-03

### Added
- **SDWAN 网络设备分类**：左侧边栏新增 5 类 SDWAN 设备，排序置顶显示
  - **SDWAN节点**（☁️）：云服务器节点形态，左右 2 固定接入点，预置 3 个设备型号
  - **互联网网络**（🌐）：万维网地球图标，左右 2 固定接入点，预置 2 个设备型号
  - **公有云**（☁️）：云平台+服务器机架组合，预置 5 家云厂商（阿里云/腾讯云/华为云/AWS/Azure）
  - **数据中心**（🏢）：3 服务器机架集群，左右 2 固定接入点，预置 3 个设备型号
  - **SDWAN设备**（🔷）：防火墙同款 chassis，4×GE+2×SFP 物理端口，预置 3 个设备型号
- 云设备固定连接点：前 4 类无端口云设备使用 `CP-LEFT`/`CP-RIGHT` Handle，连线从左右侧出
- 5 组主题 CSS 变量（`--color-cat-sdwan-*`），支持默认/鎏金双主题
- 数据库增量迁移：SDWAN 分类 sort_order 1-5 置顶，现有分类自动下移

### Changed
- 文件格式版本保持 1.1.0（无 breaking changes）

---

## [1.1.0] — 2026-07-02

### Added
- **网络机柜绘制**：左侧边栏新增"网络机柜"区域，支持拖拽标准机柜到画布
  - 标准机柜尺寸：6U, 9U, 12U, 18U, 22U, 27U, 32U, 36U, 42U, 45U, 47U
  - 紧凑/详细双视图模式：默认前面板展示，双击切换为接口细节视图
  - U 位槽位系统：每 1U 为独立模块，设备拖入自动吸附 U 位
  - 机柜附件：理线器、盲板、PDU（电源分配单元）
- **机柜内设备节点**（`rackDeviceNode`）：
  - 前面板模式：紧凑面板条，显示分类颜色/设备名/U 高度
  - 详细模式：展开显示设备完整 SVG 插图 + 端口连接点
  - 支持多 U 设备，默认 U 高度基于设备类别，可配置调整
- **机柜内拖放**：设备拖入机柜自动检测空间并吸附到 U 位；机柜满时提示
- **机柜内设备拖拽**：拖拽停止自动 U 位吸附，冲突检测
- **删除机柜级联**：删除机柜时自动移除所有子设备
- 新增 4 个设备类别：配线架、超融合、存储、运营商光猫（含 13 个设备型号）
- 机柜主题支持：默认/鎏金双主题 CSS 变量完整覆盖

### Changed
- 文件格式版本升级至 1.1.0（支持 parentId 和 extent 序列化）
- `TopoNode` 类型扩展为支持多种节点数据类型

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
