# 第三阶段 UI / UX 精修与截图审计

## 范围

保留全部功能、已有业务 Composables 和 API contract。未修改 Backend、版本号、tag 或 Release。
本轮只加入展示状态、草稿提示/确认、编辑器键盘辅助和样式细节。

## 按模块检查

| 模块 | 本轮改进 | 桌面 / 移动截图 |
| --- | --- | --- |
| Nodes | 定位当前节点；选择后的批量菜单；排序方向与 aria-sort；测速运行/停止；搜索空态；速度 0；长名称两行、展开完整内容；窄屏指标分层 | `1920-nodes-default.png` / `320-nodes-default.png` |
| App Shell / Runtime | 跳转到内容链接；清晰失败原因；Runtime 长名称限制高度；移动导航图标/标签对齐；固定安全区高度，保存条不被盖住 | `1920-runtime-default.png` / `390-runtime-default.png` |
| Subscriptions | 桌面启用状态徽标；保留完整更新时间；单个/全量更新状态和真实进度文本 | `1920-subscriptions-default.png` / `390-subscriptions-default.png` |
| Routing | 配置草稿提示；切换规则集/刷新前确认；选中状态辅助属性；规则 JSON 的 Tab / Ctrl+Enter | `1920-routing-default.png` / `390-routing-default.png` |
| Settings | 保存中、未保存与无未保存修改的明确状态；失败保留草稿；离开/关闭页面保护 | `1920-settings-default.png` / `390-settings-default.png` |
| DNS | 基础/各 Core 草稿独立判断；刷新保护；跨 Core 保存前说明其他草稿会被重载；键盘编辑 | `1920-dns-default.png` / `390-dns-default.png` |
| Maintenance | 区分 Backend 服务、代理 Core、Geo 数据；使用 Backend 给出的更新名称/版本；展示检查详情和失败/完成状态 | `1920-maintenance-default.png` / `390-maintenance-default.png` |
| Logs | 真正暂停实时展示、恢复加载最近日志；文本级别过滤；跳到最新；等宽字体；固定滚动条空间 | `1920-logs-default.png` / `390-logs-default.png` |
| Templates | 每个 Core 的保存基线独立；保存失败不清草稿；保存中禁止重复点击；刷新确认；Tab 缩进、Shift+Tab 离开、Ctrl+Enter 保存 | `1920-templates-default.png` / `390-templates-default.png` |

截图位于 [`screenshots/polish/`](screenshots/polish/)，全部使用隔离 fixture，未操作真实 Backend。
桌面 Runtime 截图检查顶栏/状态条，移动端检查 Core 详情弹层。

## 专项 polish checklist

- [x] padding / gap 使用共享尺度，未再增加卡片层次。
- [x] Button / Input 保持桌面 32px、移动 44px；字号、图标和圆角沿用 tokens。
- [x] hover / focus / active / disabled 回归；表单焦点、Escape 和菜单键盘动作保留。
- [x] Modal 宽度、移动全屏编辑与确认弹窗规则保留。
- [x] 原生桌面表格单元格恢复 `table-cell`，不再被文本截断样式破坏对齐。
- [x] 请求反馈保留低高度区域；首次请求结束会正确清除 loading。
- [x] 无节点、搜索无结果、订阅为空、日志无匹配都有明确反馈；已有行不会因加载消失。
- [x] Logs 关闭 scroll anchoring、预留 scrollbar gutter；暂停不关闭 SSE，不影响运行状态/流量。
- [x] 新增反馈文案有简体、繁体和英文；既有 Desktop-parity 文案保留。
- [x] 320 / 390px 无页面横向溢出，长英文导航不重叠；长节点名默认紧凑且可展开。
- [x] 1920×1080 / 2560×1440 桌面；1000 个节点、长 URL、约 6000 字符日志文本。
- [x] 每个模块截图检查；另检查批量选择、loading、error、empty、dirty、订阅进度、暂停和跨 Core 草稿确认。

## 真实问题与修复

1. Nodes 数值 `speed=0` 被当作空值显示为 `—`，现保留 0。
2. 直接由 Vue 事件触发的读取失败可能成为未处理异常。UI 入口只接住已展示的请求错误；未知程序错误不被静默隐藏。
3. `td.address-cell/group-cell/ip-cell` 被共享截断规则设为 `inline-block`，破坏桌面表格边框/列布局；桌面恢复原生单元格显示。
4. 进入 Logs 时若数据已缓存，非 immediate 的监听不会触发首次自动滚动；现初始化时按现有“自动滚动”设置定位末尾。
5. 保存某个 Core DNS 会调用原有 `loadDns()` 重载全部配置，可能丢掉其他标签中的未保存内容。现在先明确提示，取消不会发送保存请求。

审计还修复了本轮反馈层的首次请求 reactive proxy 问题、分区保存基线隔离问题，以及窄屏标题/指标/导航和保存条的布局问题。

## 验证

- `npm test`、`npm run typecheck`、`npm run build`。
- `allPages.mjs`：128 组页面/视口/语言组合，22 项原有保存/更新/导入交互。
- `polishAudit.mjs`：84 张截图，4 种视口、9 个模块及关键状态；索引见 `screenshots/polish/audit.json`。
- `designSystem.mjs`：96 组视觉状态检查。
- `batchSpeedtests.mjs`：30 项测速及节点工具请求。
- `moduleBoundaries.mjs`：16 项编辑器、订阅、Core 与 Session 请求。
- `mobileStatus.mjs`：36 组运行状态/内容/移动视口组合。

浏览器测试均为隔离 fixture；不替代真实不同浏览器、网络和 Backend 版本的联调。

## 留待以后，不在本轮继续改

- 超大节点列表虚拟化/分页，需要单独验证选中、键盘焦点与测速结果更新。
- 外部 SSE 刷新与本地草稿的合并/冲突提示，可进一步覆盖主动刷新之外的情况。
- 日志 API 没有结构化 severity，本轮明确使用文本正则预设，不假装精确级别筛选。
- 订阅进度没有百分比，不伪造进度条；Core 更新目标也未统一报告已安装 Core 版本。
- 生产主 chunk 略超 Vite 的 500kB 建议阈值；可以后独立评估按模块加载，本轮不借此继续重构。
