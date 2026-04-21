# Pager

<div align="center">

![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)
![Electron](https://img.shields.io/badge/Electron-39.2.6-9FE349.svg)
![React](https://img.shields.io/badge/React-19.2.1-61DAFB.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Kwensiu/Pager)

**一个功能强大的多网站管理桌面应用程序**

[快速开始](#快速开始) • [功能特性](#功能特性) • [文档](#用户文档) • [贡献](#贡献指南)

</div>

---

## 简介

Pager 是一个基于 Electron + React + TypeScript 构建的桌面应用程序，提供侧边栏界面来管理和访问多个网站，旨在通过结构化组织网络资源来提高生产力。

**注意：本项目目前处于早期测试阶段，功能和特性可能在开发过程中发生重大变化。**

## 功能特性

### 🎯 核心功能

- **侧边栏管理** - 两级组织结构（分类和分组）管理网站
- **拖拽排序** - 支持分类、分组和网站的拖拽排序
- **多标签页浏览** - 每个网站在新标签页中打开，支持标签页管理
- **网站图标管理** - 自动获取和缓存网站 favicon
- **导航工具栏** - 前进/后退、刷新、主页等导航功能

### 🔧 高级功能

- **扩展管理** - 支持标准 Chrome 扩展（文件夹、ZIP、CRX）
- **扩展隔离** - 多级隔离级别（严格/标准/宽松/无）
- **权限管理** - 精细的扩展权限控制
- **浏览器指纹伪装** - 防止网站通过指纹追踪用户
- **JS 代码注入** - 向特定网站注入自定义脚本
- **代理支持** - HTTP/HTTPS 代理配置

### ⚡ 性能优化

- **内存优化** - 自动清理不活跃网站的内存
- **会话隔离** - 独立的会话管理
- **缓存管理** - 智能缓存策略

### 🎨 用户体验

- **主题支持** - 浅色/深色主题，跟随系统
- **国际化** - 完整的中文/英文支持
- **全局快捷键** - 提高操作效率
- **系统托盘** - 最小化到托盘，快捷菜单
- **自动启动** - 开机自动运行

### 📦 数据管理

- **数据同步** - 配置导入/导出
- **Cookie 管理** - Cookie 导入/导出
- **自动更新** - 检查并自动安装更新

## 技术栈

### 核心框架

- **Electron** - 跨平台桌面应用框架
- **React** - 用户界面库
- **TypeScript** - 类型安全的 JavaScript 超集
- **Vite** - 快速的构建工具

### UI 组件

- **Shadcn UI** - 高质量 React 组件库
- **Radix UI** - 无障碍的 UI 原语
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Lucide React** - 精美的图标库

### 功能库

- **@dnd-kit** - 现代化的拖拽排序库
- **i18next** - 国际化框架
- **electron-store** - 持久化数据存储
- **electron-updater** - 自动更新
- **fingerprint-generator** - 浏览器指纹生成

## 项目结构

```
pager/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── core/       # 核心功能（应用、窗口）
│   │   ├── extensions/ # 扩展管理
│   │   ├── ipc/        # IPC 通信处理
│   │   ├── services/   # 各种服务（代理、缓存、主题等）
│   │   └── types/      # 类型定义
│   ├── preload/        # 预加载脚本
│   └── renderer/       # React 渲染进程
│       ├── components/ # React 组件
│       ├── pages/      # 页面
│       ├── core/       # 核心功能（i18n、存储）
│       └── ui/         # UI 组件
├── docs/               # 文档
├── build/              # 构建资源
└── resources/          # 应用资源
```

## 用户文档

完整的用户文档可在 [docs/](docs/) 目录中找到：

- [文档索引](docs/index.md) - 文档导航和快速链接
- [快速开始指南](docs/quickstart.md) - 5分钟上手教程
- [安装指南](docs/installation.md) - 系统要求和安装步骤
- [功能详解](docs/features.md) - 所有功能的详细说明
- [完整用户文档](docs/README.md) - 完整的用户手册

## 开发环境配置

### 系统要求

- **Node.js**: ^20.19.0 || >=22.12.0
- **pnpm**: >= 1.22.0
- **操作系统**: Windows 10+, macOS 10.15+, Linux

### 推荐 IDE 设置

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## 项目设置

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 启动开发服务器
pnpm dev

# 格式化代码（在执行主要任务前先运行）
pnpm format
```

### 代码检查

```bash
# 只读格式检查（CI 同款）
pnpm format:check

# 运行测试
pnpm test

# 类型检查
pnpm typecheck

# ESLint 检查
pnpm lint
```

### 构建应用程序

```bash
# 构建所有平台
pnpm build

# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

### 开发工作流

按照以下顺序执行开发任务：

1. `pnpm install` - 安装依赖
2. `pnpm format` - 本地自动格式化
3. `pnpm format:check` - 只读格式检查
4. `pnpm test` - 运行测试
5. `pnpm lint` - ESLint 检查
6. `pnpm typecheck` - 类型检查
7. `pnpm build` - 构建应用

## 常见问题

### Q: 为什么使用 pnpm 而不是 npm？

A: 本项目使用 pnpm 作为包管理器，所有脚本执行必须使用 `pnpm` 前缀。这是项目规范的一部分，确保依赖管理的一致性。

### Q: 如何切换主题？

A: 点击右上角的设置图标（齿轮图标），在"外观"设置中选择浅色主题、深色主题或跟随系统。

### Q: 支持哪些扩展格式？

A: Pager 支持标准的 Chrome 扩展格式，包括：

- 文件夹安装（包含 `manifest.json`）
- ZIP 文件安装
- CRX 文件安装

### Q: 如何备份数据？

A: 在设置页面中，使用"导出配置"功能将当前设置导出为 JSON 文件。也可以使用"导出 Cookie"功能备份登录状态。

## 贡献指南

欢迎贡献代码、报告问题或提出改进建议！

### 提交代码

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 编写代码
- 遵循 ESLint 和 Prettier 配置
- 提交前运行 `pnpm format:check`、`pnpm test`、`pnpm lint` 和 `pnpm typecheck`
- 提交信息使用英文，遵循现有格式（`git log --oneline -5`）

### 报告问题

在 [GitHub Issues](https://github.com/Kwensiu/Pager/issues) 中报告问题时，请提供：

- 详细的问题描述
- 复现步骤
- 系统环境信息
- 相关的日志或截图

## 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件。

版权所有 (c) 2026 Kwensiu

## 致谢

感谢以下开源项目：

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## 联系方式

- **GitHub**: [https://github.com/Kwensiu/Pager](https://github.com/Kwensiu/Pager)
- **Issues**: [https://github.com/Kwensiu/Pager/issues](https://github.com/Kwensiu/Pager/issues)

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️**

</div>
