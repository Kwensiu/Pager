# 安装指南

本指南将帮助您在不同平台上安装和配置 Pager 应用程序。

## 📋 目录

- [系统要求](#系统要求)
- [下载安装](#下载安装)
- [从源代码构建](#从源代码构建)
- [更新应用程序](#更新应用程序)
- [卸载](#卸载)
- [数据位置](#数据位置)
- [故障排除](#故障排除)

---

## 系统要求

### Windows

| 项目     | 最低要求              | 推荐配置       |
| -------- | --------------------- | -------------- |
| 操作系统 | Windows 10 或更高版本 | Windows 11     |
| 处理器   | x64 架构              | x64 架构       |
| 内存     | 4GB RAM               | 8GB RAM 或更多 |
| 磁盘空间 | 500MB 可用空间        | 1GB 可用空间   |

### macOS

| 项目     | 最低要求                          | 推荐配置                       |
| -------- | --------------------------------- | ------------------------------ |
| 操作系统 | macOS 10.15 (Catalina) 或更高版本 | macOS 12 (Monterey) 或更高版本 |
| 处理器   | Intel x64 或 Apple Silicon        | Apple Silicon (M1/M2/M3)       |
| 内存     | 4GB RAM                           | 8GB RAM 或更多                 |
| 磁盘空间 | 500MB 可用空间                    | 1GB 可用空间                   |

### Linux

| 项目     | 最低要求                      | 推荐配置                |
| -------- | ----------------------------- | ----------------------- |
| 操作系统 | Ubuntu 20.04 或其他现代发行版 | Ubuntu 22.04 LTS 或更新 |
| 处理器   | x64 架构                      | x64 架构                |
| 内存     | 4GB RAM                       | 8GB RAM 或更多          |
| 磁盘空间 | 500MB 可用空间                | 1GB 可用空间            |
| 依赖     | GLIBC 2.28 或更高版本         | GLIBC 2.31 或更高版本   |

---

## 下载安装

### 从 GitHub Releases 下载

1. 访问 [Pager GitHub Releases](https://github.com/Kwensiu/Pager/releases)
2. 选择最新版本
3. 下载适合您操作系统的安装包：
   - **Windows**: `Pager-x.x.x-setup.exe` 安装程序
   - **macOS**: `Pager-x.x.x.dmg` 镜像文件
   - **Linux**: `Pager-x.x.x.AppImage` 或 `Pager-x.x.x.deb` 包

### Windows 安装

#### 使用安装程序

1. 双击下载的 `.exe` 文件
2. 按照安装向导提示操作：
   - 选择安装目录（默认：`C:\Program Files\Pager`）
   - 选择是否创建桌面快捷方式
   - 选择是否添加到开始菜单
3. 点击"安装"按钮
4. 等待安装完成
5. 完成后，可以从开始菜单或桌面快捷方式启动 Pager

#### 验证安装

1. 打开"开始菜单"
2. 搜索"Pager"
3. 点击应用程序图标启动

### macOS 安装

#### 使用 DMG 镜像

1. 双击下载的 `.dmg` 文件
2. 将 Pager 应用程序拖拽到"应用程序"文件夹
3. 等待复制完成
4. 从"应用程序"文件夹启动 Pager

#### 首次运行

由于 macOS 的安全限制，首次运行可能需要：

1. 右键点击 Pager 应用程序
2. 选择"打开"
3. 在弹出的安全对话框中点击"打开"

或者：

1. 打开"系统偏好设置" → "安全性与隐私"
2. 在"通用"标签页中找到 Pager
3. 点击"仍要打开"

### Linux 安装

#### 使用 AppImage（推荐）

AppImage 是一种便携式应用程序格式，无需安装即可运行。

```bash
# 添加执行权限
chmod +x Pager-*.AppImage

# 运行应用程序
./Pager-*.AppImage
```

**创建桌面快捷方式**：

```bash
# 创建 .desktop 文件
cat > ~/.local/share/applications/pager.desktop << EOF
[Desktop Entry]
Name=Pager
Comment=Multi-website management desktop application
Exec=/path/to/Pager-*.AppImage
Icon=pager
Terminal=false
Type=Application
Categories=Utility;
EOF

# 更新桌面数据库
update-desktop-database ~/.local/share/applications/
```

#### 使用 DEB 包（Ubuntu/Debian）

```bash
# 安装 DEB 包
sudo dpkg -i Pager-*.deb

# 如果遇到依赖问题，运行：
sudo apt-get install -f
```

#### 使用 RPM 包（Fedora/RHEL）

```bash
# 安装 RPM 包
sudo rpm -i Pager-*.rpm

# 或者使用 dnf（Fedora）
sudo dnf install Pager-*.rpm

# 或者使用 yum（RHEL/CentOS）
sudo yum install Pager-*.rpm
```

#### 使用 Snap 包

```bash
# 安装 Snap 包
sudo snap install pager --classic
```

---

## 从源代码构建

如果您想从源代码构建 Pager，请按照以下步骤操作。

### 前提条件

- **Node.js**: >= 18.0.0
- **pnpm**: >= 1.22.0
- **Git**: 最新版本
- **Python**: >= 3.6（用于构建原生模块）

### 开发环境设置

#### 1. 克隆仓库

```bash
git clone https://github.com/Kwensiu/Pager.git
cd Pager
```

#### 2. 安装依赖

```bash
# 使用 pnpm 安装依赖（必须使用 pnpm）
pnpm install
```

#### 3. 开发模式

```bash
# 启动开发服务器
pnpm dev
```

开发模式会启动热重载，您可以实时查看代码更改的效果。

#### 4. 代码检查

```bash
# 格式化代码
pnpm format

# 类型检查
pnpm typecheck

# ESLint 检查
pnpm lint
```

### 构建应用程序

#### 构建所有平台

```bash
# 构建应用程序（包含类型检查）
pnpm build
```

#### 构建特定平台

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

构建完成后，安装包将位于 `dist/` 目录中。

### 开发依赖

推荐的开发工具：

- **IDE**: [Visual Studio Code](https://code.visualstudio.com/)
- **扩展**:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense

### 构建工作流

按照以下顺序执行构建任务：

1. `pnpm install` - 安装依赖
2. `pnpm format` - 格式化代码
3. `pnpm typecheck` - 类型检查
4. `pnpm build` - 构建应用

---

## 更新应用程序

### 自动更新

Pager 支持自动更新功能：

1. 打开"设置" → "版本信息"
2. 启用"自动检查更新"
3. 应用程序将在启动时检查更新
4. 如果有新版本，会显示更新对话框
5. 点击"下载并安装"按钮
6. 更新完成后，应用程序会自动重启

### 手动更新

#### Windows

1. 从 [GitHub Releases](https://github.com/Kwensiu/Pager/releases) 下载最新版本的安装程序
2. 运行安装程序
3. 选择"修复"或"更新"选项
4. 您的数据和设置将被保留

#### macOS

1. 从 [GitHub Releases](https://github.com/Kwensiu/Pager/releases) 下载最新版本的 DMG 文件
2. 打开 DMG 文件
3. 将新的 Pager 应用程序拖拽到"应用程序"文件夹
4. 选择"替换"现有版本
5. 您的数据和设置将被保留

#### Linux

```bash
# AppImage
# 直接下载新的 AppImage 文件并替换旧文件

# DEB 包
sudo dpkg -i Pager-*.deb

# RPM 包
sudo rpm -U Pager-*.rpm

# Snap 包
sudo snap refresh pager
```

---

## 卸载

### Windows

#### 使用控制面板

1. 打开"控制面板" → "程序和功能"
2. 找到"Pager"
3. 右键点击并选择"卸载"
4. 按照卸载向导提示操作

#### 使用安装程序

1. 导航到安装目录（默认：`C:\Program Files\Pager`）
2. 运行 `uninstall.exe`
3. 按照卸载向导提示操作

#### 手动删除数据（可选）

```powershell
# 删除用户数据
Remove-Item -Recurse -Force $env:APPDATA\pager

# 删除日志文件
Remove-Item -Recurse -Force $env:APPDATA\pager\logs
```

### macOS

1. 打开"应用程序"文件夹
2. 将"Pager"拖拽到废纸篓
3. 清空废纸篓

#### 手动删除数据（可选）

```bash
# 删除用户数据
rm -rf ~/Library/Application\ Support/pager

# 删除日志文件
rm -rf ~/Library/Logs/pager

# 删除缓存
rm -rf ~/Library/Caches/pager
```

### Linux

#### AppImage

```bash
# 删除 AppImage 文件
rm Pager-*.AppImage

# 删除桌面快捷方式
rm ~/.local/share/applications/pager.desktop

# 删除用户数据
rm -rf ~/.config/pager
```

#### DEB 包

```bash
# 卸载
sudo apt remove pager

# 删除配置文件（可选）
sudo apt purge pager

# 删除用户数据（可选）
rm -rf ~/.config/pager
```

#### RPM 包

```bash
# 卸载
sudo yum remove pager

# 或使用 dnf
sudo dnf remove pager

# 删除用户数据（可选）
rm -rf ~/.config/pager
```

#### Snap 包

```bash
# 卸载
sudo snap remove pager

# 删除用户数据（可选）
rm -rf ~/snap/pager
```

---

## 数据位置

### Windows

| 数据类型 | 位置                          |
| -------- | ----------------------------- |
| 用户数据 | `%APPDATA%\pager`             |
| 日志文件 | `%APPDATA%\pager\logs`        |
| 缓存     | `%APPDATA%\pager\cache`       |
| 配置文件 | `%APPDATA%\pager\config.json` |

**快速访问**：

1. 按 `Win + R` 打开运行对话框
2. 输入 `%APPDATA%\pager`
3. 按回车

### macOS

| 数据类型 | 位置                                              |
| -------- | ------------------------------------------------- |
| 用户数据 | `~/Library/Application Support/pager`             |
| 日志文件 | `~/Library/Logs/pager`                            |
| 缓存     | `~/Library/Caches/pager`                          |
| 配置文件 | `~/Library/Application Support/pager/config.json` |

**快速访问**：

1. 打开 Finder
2. 按 `Cmd + Shift + G`
3. 输入 `~/Library/Application Support/pager`
4. 按回车

### Linux

| 数据类型 | 位置                          |
| -------- | ----------------------------- |
| 用户数据 | `~/.config/pager`             |
| 日志文件 | `~/.config/pager/logs`        |
| 缓存     | `~/.cache/pager`              |
| 配置文件 | `~/.config/pager/config.json` |

**快速访问**：

```bash
# 打开用户数据目录
cd ~/.config/pager

# 或使用文件管理器
xdg-open ~/.config/pager
```

---

## 故障排除

### 安装失败

#### Windows

1. **确保有足够的磁盘空间**
   - 检查 C 盘是否有至少 1GB 可用空间

2. **检查系统权限**
   - 以管理员身份运行安装程序
   - 右键点击安装程序 → "以管理员身份运行"

3. **检查防病毒软件**
   - 临时禁用防病毒软件
   - 或将 Pager 添加到白名单

4. **检查 Windows 版本**
   - 确保使用 Windows 10 或更高版本
   - 运行 `winver` 查看版本信息

#### macOS

1. **检查 Gatekeeper 设置**
   - 打开"系统偏好设置" → "安全性与隐私"
   - 允许从"任何来源"下载的应用（macOS 10.14 及更早版本）

2. **检查磁盘权限**
   - 打开"磁盘工具"
   - 选择启动磁盘
   - 点击"急救"修复磁盘权限

3. **检查 macOS 版本**
   - 确保使用 macOS 10.15 (Catalina) 或更高版本
   - 点击苹果菜单 → "关于本机"

#### Linux

1. **检查依赖**

   ```bash
   # Ubuntu/Debian
   sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libuuid1 libappindicator3-1 libsecret-1-0

   # Fedora/RHEL
   sudo dnf install gtk3 libnotify nss libXScrnSaver libXtst xdg-utils at-spi2-core libuuid libappindicator-gtk3 libsecret
   ```

2. **检查 GLIBC 版本**
   ```bash
   ldd --version
   ```
   确保版本 >= 2.28

### 启动失败

#### 通用步骤

1. **检查系统要求**
   - 确保操作系统版本满足最低要求
   - 确保有足够的内存和磁盘空间

2. **查看日志文件**
   - 打开日志文件查看错误信息
   - 日志位置见[数据位置](#数据位置)部分

3. **重新安装应用程序**
   - 完全卸载应用程序
   - 重新下载并安装最新版本

4. **检查用户数据目录**
   - 备份用户数据
   - 删除用户数据目录
   - 重新启动应用程序

#### Windows 特定

1. **检查 .NET Framework**
   - 确保安装了 .NET Framework 4.7.2 或更高版本

2. **检查 Visual C++ 运行库**
   - 下载并安装 [Microsoft Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)

#### macOS 特定

1. **检查安全设置**
   - 打开"系统偏好设置" → "安全性与隐私"
   - 查看"隐私"标签页中的设置

2. **检查磁盘权限**
   - 使用"磁盘工具"修复磁盘权限

#### Linux 特定

1. **检查显示服务器**
   - 确保正在运行 X11 或 Wayland
   - 检查 `DISPLAY` 环境变量

2. **检查库依赖**
   ```bash
   ldd /path/to/Pager
   ```
   查看是否有缺失的库

### 网络问题

1. **检查防火墙设置**
   - 确保 Pager 允许访问网络
   - 添加防火墙例外规则

2. **检查代理设置**
   - 如果使用代理，确保配置正确
   - 在 Pager 设置中配置代理

3. **检查 DNS 设置**
   - 尝试使用不同的 DNS 服务器
   - 例如：8.8.8.8 或 1.1.1.1

### 性能问题

1. **减少同时打开的网站数量**
   - 关闭不需要的标签页
   - 使用内存优化功能

2. **启用硬件加速**
   - 在设置中启用硬件加速（如果可用）

3. **清理缓存**
   - 在设置中清除缓存
   - 或手动删除缓存目录

4. **检查系统资源**
   - 使用任务管理器/活动监视器查看资源使用情况
   - 关闭其他占用资源的程序

---

## 获取帮助

如果您在安装或使用 Pager 时遇到问题：

1. 查看[常见问题](README.md#常见问题)
2. 查看[故障排除](README.md#故障排除)
3. 在 [GitHub Issues](https://github.com/Kwensiu/Pager/issues) 搜索类似问题
4. 提交新的 Issue，包含：
   - 操作系统版本
   - Pager 版本
   - 详细的错误描述
   - 复现步骤
   - 相关的日志或截图

---

**提示**：安装前建议备份重要数据。卸载应用程序不会删除用户数据，如需完全清除，请手动删除用户数据目录。
