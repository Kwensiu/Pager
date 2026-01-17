# Pager 发布指南

## 发布流程

### 1. 准备工作

确保以下条件满足：

- 代码已提交到 main 分支
- 所有测试通过
- 版本号已确定（遵循语义化版本规范）

### 2. 创建 Git 标签

使用以下命令创建新版本标签：

```bash
# 查看当前版本
git describe --tags --abbrev=0

# 创建新标签（例如 v0.1.0）
git tag -a v0.1.0 -m "Release v0.1.0"

# 推送标签到远程仓库
git push origin v0.1.0
```

### 3. GitHub Action 自动触发

推送标签后，GitHub Action 将自动：

1. 运行 lint、typecheck 和构建检查
2. 为 Windows、macOS 和 Linux 构建应用程序
3. 更新 package.json 中的版本号
4. 上传构建产物到 GitHub Releases
5. 配置自动更新

### 4. 手动发布（可选）

如果需要手动触发发布，可以在 GitHub Actions 页面：

1. 导航到 "Release Build" 工作流
2. 点击 "Run workflow"
3. 输入版本号（如 0.1.0）
4. 选择要构建的平台
5. 点击 "Run workflow"

## 版本管理

### 语义化版本规范

- **主版本号 (MAJOR)**：不兼容的 API 修改
- **次版本号 (MINOR)**：向下兼容的功能性新增
- **修订号 (PATCH)**：向下兼容的问题修正

### 版本号示例

- `v0.0.1` - 初始版本
- `v0.1.0` - 新增功能
- `v0.1.1` - 修复 bug
- `v1.0.0` - 稳定版本

## GitHub Actions 配置

### 工作流文件

1. **CI 工作流** (`.github/workflows/ci.yml`)
   - 触发条件：推送到 main 分支或创建 PR
   - 功能：运行代码质量检查

2. **发布工作流** (`.github/workflows/release.yml`)
   - 触发条件：创建 v*.*.\* 格式的标签
   - 功能：构建多平台应用并发布到 GitHub Releases

### 自动更新配置

应用使用 `electron-updater` 从 GitHub Releases 自动更新：

- 配置在 `dev-app-update.yml` 和 `electron-builder.yml` 中
- 用户启动应用时会检查更新
- 支持静默更新和用户确认更新

## 构建产物

每次发布会生成以下文件：

### Windows

- `pager-{version}-setup.exe` - Windows 安装程序
- `pager-{version}-win.zip` - 便携版

### macOS

- `pager-{version}.dmg` - macOS 磁盘映像
- `pager-{version}.zip` - 压缩包

### Linux

- `pager-{version}.AppImage` - AppImage 格式
- `pager-{version}.deb` - Debian 包
- `pager-{version}.snap` - Snap 包

## 故障排除

### 常见问题

1. **构建失败**
   - 检查 Node.js 版本（需要 20+）
   - 确保 yarn 依赖安装正确
   - 查看 GitHub Actions 日志

2. **自动更新不工作**
   - 检查 GitHub token 权限
   - 验证 `dev-app-update.yml` 配置
   - 确保 Releases 中有正确的构建文件

3. **版本号不更新**
   - 确保标签格式正确（v*.*.\*）
   - 检查 package.json 版本更新逻辑

### 调试建议

- 在本地运行 `yarn build:win` 测试构建
- 检查 GitHub Actions 的 Secrets 配置
- 查看 electron-builder 日志
