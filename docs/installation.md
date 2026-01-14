# 安装指南

## 系统要求

### Windows

- Windows 10 或更高版本
- 4GB RAM（推荐 8GB）
- 500MB 可用磁盘空间

### macOS

- macOS 10.15 (Catalina) 或更高版本
- 4GB RAM（推荐 8GB）
- 500MB 可用磁盘空间

### Linux

- Ubuntu 20.04 或更高版本（或其他现代 Linux 发行版）
- 4GB RAM（推荐 8GB）
- 500MB 可用磁盘空间
- GLIBC 2.28 或更高版本

## 下载安装

### 从 GitHub Releases 下载

1. 访问 [Pager GitHub Releases](https://github.com/Kwensiu/pager/releases)
2. 下载适合您操作系统的安装包：
   - Windows: `.exe` 安装程序
   - macOS: `.dmg` 镜像文件
   - Linux: `.AppImage` 或 `.deb` 包

### Windows 安装

1. 双击下载的 `.exe` 文件
2. 按照安装向导提示操作
3. 选择安装目录（默认：`C:\Program Files\Pager`）
4. 完成安装后，可以从开始菜单启动 Pager

### macOS 安装

1. 双击下载的 `.dmg` 文件
2. 将 Pager 应用程序拖拽到"应用程序"文件夹
3. 首次运行时，可能需要右键点击并选择"打开"来绕过 Gatekeeper 安全限制

### Linux 安装

#### 使用 AppImage

```bash
chmod +x Pager-*.AppImage
./Pager-*.AppImage
```

#### 使用 DEB 包（Ubuntu/Debian）

```bash
sudo dpkg -i Pager-*.deb
```

#### 使用 RPM 包（Fedora/RHEL）

```bash
sudo rpm -i Pager-*.rpm
```

## 从源代码构建

### 前提条件

- Node.js 18 或更高版本
- Yarn 包管理器
- Git

### 构建步骤

1. 克隆仓库：

   ```bash
   git clone https://github.com/Kwensiu/pager.git
   cd pager
   ```

2. 安装依赖：

   ```bash
   yarn install
   ```

3. 运行开发模式：

   ```bash
   yarn dev
   ```

4. 构建应用程序：

   ```bash
   # Windows
   yarn build:win

   # macOS
   yarn build:mac

   # Linux
   yarn build:linux
   ```

### 开发依赖

- Visual Studio Code（推荐）
- ESLint 和 Prettier 扩展
- TypeScript 支持

## 更新应用程序

### 自动更新

Pager 支持自动更新功能：

1. 打开"设置" → "增强功能" → "版本检查"
2. 启用"自动检查更新"
3. 应用程序将在启动时检查更新

### 手动更新

1. 下载最新版本的安装包
2. 运行安装程序覆盖现有版本
3. 您的数据和设置将被保留

## 卸载

### Windows

1. 打开"控制面板" → "程序和功能"
2. 找到"Pager"并选择"卸载"
3. 或者使用安装目录中的 `uninstall.exe`

### macOS

1. 打开"应用程序"文件夹
2. 将"Pager"拖拽到废纸篓
3. 清空废纸篓

### Linux

#### AppImage

```bash
rm ~/.local/share/applications/pager.desktop
rm ~/.config/pager
```

#### DEB 包

```bash
sudo apt remove pager
```

#### RPM 包

```bash
sudo yum remove pager
```

## 数据位置

### Windows

- 用户数据：`%APPDATA%\pager`
- 日志文件：`%APPDATA%\pager\logs`

### macOS

- 用户数据：`~/Library/Application Support/pager`
- 日志文件：`~/Library/Logs/pager`

### Linux

- 用户数据：`~/.config/pager`
- 日志文件：`~/.config/pager/logs`

## 故障排除

### 安装失败

1. 确保有足够的磁盘空间
2. 检查系统权限
3. 尝试以管理员/root权限运行安装程序

### 启动失败

1. 检查系统要求是否满足
2. 查看日志文件中的错误信息
3. 尝试重新安装应用程序

### 网络问题

1. 检查防火墙设置
2. 确保可以访问 GitHub Releases
3. 尝试手动下载安装包
