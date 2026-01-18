# Inno Setup 构建指南

本文档介绍如何使用 Inno Setup 为 Pager 应用程序创建 Windows 安装程序。

## 安装 Inno Setup

### 本地开发环境

1. 下载 Inno Setup 6.x
   - 访问 [https://jrsoftware.org/isdl.php](https://jrsoftware.org/isdl.php)
   - 下载并安装 Inno Setup

2. 验证安装
   ```bash
   # 检查 Inno Setup 是否正确安装
   iscc.exe /?
   ```

### CI/CD 环境

在 GitHub Actions 中，Inno Setup 会自动安装和配置。

## 构建命令

### 本地构建

```bash
# 构建 Inno Setup 安装程序
yarn build:inno

# 构建便携版
yarn build:portable

# 构建所有 Windows 版本
yarn build:win
```

### CI/CD 构建

GitHub Actions 工作流会自动：
1. 安装 Inno Setup
2. 构建应用程序
3. 生成安装程序
4. 上传到 GitHub Release

## 配置文件

### electron-builder.yml

```yaml
win:
  executableName: Pager
  target:
    - target: inno      # Inno Setup 安装程序
      arch: [x64]
    - target: portable   # 便携版
      arch: [x64]

inno:
  artifactName: ${name}-${version}-setup.exe
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: always
  createStartMenuShortcut: true
```

### 安装脚本

- `build/installer.iss` - 主安装脚本
- `build/installer.nsh` - 自定义安装行为

## 自定义选项

### 安装程序特性

- ✅ 多语言支持（中文/英文）
- ✅ 自定义安装路径
- ✅ 桌面快捷方式
- ✅ 开始菜单快捷方式
- ✅ 升级检测和自动卸载
- ✅ 卸载数据保留选项

### 高级配置

可以在 `build/installer.iss` 中自定义：

```pascal
[Setup]
; 基本设置
AppName=Pager
AppVersion=0.0.9
DefaultDirName={pf}\Pager

; 压缩设置
Compression=lzma2
SolidCompression=yes

; 安装选项
AllowToChangeInstallationDirectory=yes
CreateDesktopShortcut=yes
```

## 故障排除

### 常见问题

1. **编译错误**
   - 检查 Inno Setup 版本（需要 6.x）
   - 验证脚本语法

2. **路径问题**
   - 确保 `build/installer.iss` 存在
   - 检查图标文件路径

3. **权限问题**
   - 以管理员身份运行
   - 检查输出目录权限

### 调试技巧

1. **详细日志**
   ```bash
   yarn build:inno --verbose
   ```

2. **测试安装**
   ```bash
   # 本地测试安装程序
   dist/Pager-0.0.9-setup.exe
   ```

## 发布流程

1. 更新版本号
2. 推送标签
3. GitHub Actions 自动构建
4. 检查 Release 页面

## 对比 NSIS

| 特性 | Inno Setup | NSIS |
|------|------------|-------|
| 脚本语言 | Pascal | NSIS脚本 |
| 多语言 | 内置支持 | 基础支持 |
| 自定义性 | 非常高 | 中等 |
| 学习曲线 | 较陡峭 | 相对简单 |
| 压缩率 | 更好 | 标准 |

Inno Setup 提供更专业的安装体验，适合需要高度自定义的项目。
