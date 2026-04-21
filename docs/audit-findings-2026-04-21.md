# Pager 项目问题审计报告（2026-04-21）

## 审计范围与方式

- 审计时间：2026-04-21
- 审计方式：4 个并发子代理分域检查 + 主线程逐条复核
- 审计约束：只读分析，不做功能修复
- 代码范围：
  - `src/main/**`（主进程、服务）
  - `src/preload/**` + `src/main/ipc/**` + `src/main/extensions/**`（边界与安全）
  - `src/renderer/**`（渲染层逻辑）
  - 工程配置、CI、发布文档与脚本

## 命令验证结果

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `pnpm build`：通过（存在 `wavy-lines.svg` 运行时解析警告）
- `pnpm build:unpack`：通过
- `pnpm test`：失败（`Command "test" not found`）
- `pnpm exec jest --runInBand`：失败（`jest not found`）

## 已确认问题清单

## Critical

### C-01 扩展配置页可注入到特权窗口

- 位置：
  - `src/main/ipc/handlers.ts:972`
  - `src/main/ipc/handlers.ts:1252`
  - `src/preload/api.ts:61`
- 证据：
  - 扩展元数据（如 `name`、`description`、`homepage_url`、`permissions`）直接插入 HTML/JS 模板。
  - 配置页窗口开启 `nodeIntegration: true` 且 `contextIsolation: false`。
  - API 由 preload 直接暴露给渲染层调用。
- 影响：
  - 恶意扩展元数据或被攻陷渲染层可触发注入，并升级为 Node/Electron 能力执行，破坏进程边界。
- 判定方式：
  - 纯代码路径可确定，无需外部条件。

## High

### H-01 preload 暴露通用 ipcRenderer，边界失守

- 位置：
  - `src/preload/api.ts:12`
  - `src/main/ipc/enhancedHandlers.ts:118`
  - `src/main/ipc/handlers.ts:1327`
- 证据：
  - `window.api.ipcRenderer.invoke/send/on` 全量透传，无白名单。
  - `fs:read-file` 对调用参数无路径约束，直接读取文件。
  - `extension:inspect-structure` 会递归扫描传入路径。
- 影响：
  - 一旦 renderer 侧有 XSS/脚本注入，主进程高权限接口可被直接调用。

### H-02 主进程安全基线过度放开

- 位置：
  - `src/main/index.ts:34`
  - `src/main/index.ts:36`
  - `src/main/core/window/index.ts:165`
- 证据：
  - 启动参数包含 `ignore-certificate-errors`、`allow-running-insecure-content`。
  - 主窗口 `sandbox: false` 且 `webviewTag: true`。
- 影响：
  - 远程内容完整性保护被削弱，风险面显著增大。

### H-03 会话清理存在确定性竞态（未等待异步清理完成）

- 位置：
  - `src/main/services/sessionIsolation.ts:144`
  - `src/main/services/sessionIsolation.ts:177`
- 证据：
  - `clearCache/clearStorageData/clearAuthCache` 触发后未 `await` 即继续删除映射并返回。
- 影响：
  - 逻辑“清理完成”和实际清理完成可能不一致，导致缓存/状态残留。

### H-04 crashHandler 未初始化，崩溃处理链路未注册

- 位置：
  - `src/main/services/crashHandler.ts:21`
  - `src/main/index.ts`
- 证据：
  - `crashHandler` 的监听注册在 `initialize()` 内。
  - 启动流程中未找到 `crashHandler.initialize()` 调用。
- 影响：
  - 崩溃报告、自动恢复、统计链路在运行中可能整体失效。

### H-05 Dashboard 用 URL 作为身份键导致上下文串线

- 位置：
  - `src/renderer/pages/Dashboard/index.tsx:48`
  - `src/renderer/pages/Dashboard/index.tsx:142`
- 证据：
  - opened 缓存去重、React `key`、显示判定均基于 `url` 而非 `website.id`。
- 影响：
  - 不同网站项同 URL 时会共享/串扰脚本、指纹、会话上下文。

### H-06 删除当前网站后 currentWebsite 未同步清理

- 位置：
  - `src/renderer/components/layout/sidebar/hooks/useSidebarLogic.ts:379`
  - `src/renderer/pages/Dashboard/index.tsx:64`
- 证据：
  - 删除逻辑更新分组数据后，未对当前激活网站状态做同步清理。
- 影响：
  - 右侧仍显示已删除网站内容，UI 与数据状态脱节。

### H-07 编辑网站后 opened 缓存不更新

- 位置：
  - `src/renderer/pages/Dashboard/index.tsx:48`
  - `src/renderer/components/layout/sidebar/hooks/useSidebarLogic.ts:311`
- 证据：
  - reducer 只有 `ADD_IF_NOT_EXISTS`，缺少 update/remove 分支。
  - 编辑后 currentWebsite 更新，但已打开缓存项未同步替换。
- 影响：
  - 编辑结果不生效或产生幽灵 WebView。

### H-08 全局刷新/复制 URL 误命中隐藏 WebView

- 位置：
  - `src/renderer/components/features/WebViewContainer.tsx:887`
  - `src/renderer/pages/Dashboard/index.tsx:141`
- 证据：
  - 可见性判断读取 `webview.style.display`。
  - 实际隐藏发生在父容器 `div`，非 `webview` 元素本身。
- 影响：
  - 全局快捷键可能作用到非当前页面，产生重复刷新/错误复制。

### H-09 测试门禁不可执行

- 位置：
  - `package.json:8`
  - `package.json:67`
- 证据：
  - 无 `test` 脚本。
  - 依赖中无 `jest` 运行器。
  - 仓库存在 `__tests__` 文件但无法执行。
- 影响：
  - 当前工程无真实自动化测试闸门。

### H-10 CI/Release 的 format check 实际会改文件

- 位置：
  - `package.json:9`
  - `.github/workflows/ci.yml:34`
  - `.github/workflows/release-build.yml:68`
- 证据：
  - `format` 脚本为 `prettier --write .`，`pnpm format --check` 会变成“写入+附加参数”。
- 影响：
  - CI 中“检查”变成“修改”，格式门禁失真。

## Medium

### M-01 WebView 事件监听在 ref callback 中泄漏

- 位置：
  - `src/renderer/components/features/WebViewContainer.tsx:719`
- 证据：
  - ref callback 返回 cleanup 不会被 React 用于解绑。
  - callback 依赖 `currentUrl`，会重复注册并形成陈旧闭包。
- 影响：
  - 重复事件处理、会话更新重复、标题与 URL 错配。

### M-02 真实崩溃模式恢复窗口操作失效

- 位置：
  - `src/main/services/crashRecoveryWindow.ts:58`
  - `src/main/services/crashRecoveryWindow.ts:633`
- 证据：
  - `will-navigate` 拦截仅在模拟崩溃模式注册。
  - 真实崩溃下按钮仍使用 `app://...` 导航方案。
- 影响：
  - 恢复窗口关键操作在真实故障场景不可用。

### M-03 渲染崩溃恢复策略互相冲突

- 位置：
  - `src/main/services/crashHandler.ts:142`
  - `src/main/services/crashHandler.ts:170`
- 证据：
  - 已选择自动重启或恢复窗口后，仍无条件 `webContents.reload()`。
- 影响：
  - 恢复流程可能打架，造成状态错乱或再次异常。

### M-04 memoryOptimizer 的 webContents 缓存失真

- 位置：
  - `src/main/services/memoryOptimizer.ts:252`
- 证据：
  - 缓存仅首次异步抓取，后续默认复用，不按生命周期刷新。
- 影响：
  - 后续新增页面可能不参与回收，优化统计偏离真实状态。

### M-05 preload 与主进程 IPC 协议漂移

- 位置：
  - `src/preload/api.ts:91`
  - `src/main/ipc/handlers.ts:1404`
  - `src/preload/api.ts:241`
  - `src/main/ipc/enhancedHandlers.ts:127`
- 证据：
  - 参数签名不一致，调用后会错位或失败。
- 影响：
  - 扩展/数据同步相关能力出现确定性运行时故障。

### M-06 i18n 覆盖不完整（英文环境仍大量中文硬编码）

- 位置：
  - `src/renderer/components/features/SettingsDialog.tsx:1485`
- 证据：
  - 部分设置与调试区域未使用 i18n 文案键。
- 影响：
  - 语言切换后界面中英混杂。

### M-07 文档与真实构建/发布流程不一致

- 位置：
  - `README.md:167`
  - `docs/installation.md:227`
  - `docs/RELEASE_GUIDE.md:71`
  - `.github/workflows/release-build.yml:16`
- 证据：
  - 文档提及 `build:mac/build:linux` 与 `release.yml`，实际脚本/工作流不匹配。
  - 发布流程实现仅 Windows。
- 影响：
  - 按文档执行会失败或得到错误预期。

## Low

### L-01 ExtensionManager 详情弹窗状态不可达

- 位置：
  - `src/renderer/components/features/ExtensionManager.tsx:58`
  - `src/renderer/components/features/ExtensionManager.tsx:729`
- 证据：
  - `selectedExtension` 仅被判空渲染与清空，未见赋值入口。
- 影响：
  - 详情弹窗逻辑基本不可触发。

## 已排除项（避免误报）

- `loadFile('../renderer/index.html')` 的生产路径问题：复核后不成立（编译后相对路径可落到 `out/renderer/index.html`）。
- `src/preload/extension-isolation.js`：当前更接近未接入死代码，不计入“运行路径必触发问题”。
- 主题切换与部分定时器泄漏怀疑项：复核后未形成确定性缺陷证据。

## 当前优先修复建议（Top 5）

1. 关闭 `extension:create-config-page` 的高危窗口配置（`nodeIntegration/contextIsolation`），并对模板插值做严格转义。
2. 移除 preload 的通用 `ipcRenderer` 暴露，改成最小白名单 API。
3. 修正 Dashboard/WebView 身份模型（统一 `website.id`，补齐 opened 缓存 update/remove）。
4. 修复会话清理与崩溃恢复链路（`await` 清理、初始化 crashHandler、去除冲突策略）。
5. 修复工程门禁（独立 `format:check`、补齐可执行 `test` 脚本与运行器、同步发布文档）。
