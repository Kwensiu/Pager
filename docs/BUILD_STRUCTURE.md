# Pager 构建目录结构

## 目录结构说明

```
pager/
├── build/                          # 构建相关文件
│   ├── out/                        # 编译输出目录
│   │   ├── main/                   # 主进程代码
│   │   │   └── index.js
│   │   ├── preload/                # 预加载脚本
│   │   │   └── index.js
│   │   └── renderer/               # 渲染进程代码
│   │       ├── index.html
│   │       └── assets/
│   │           └── wavy-lines.svg
│   ├── dist/                       # 构建输出目录
│   │   ├── win-unpacked/           # 未打包的Windows应用
│   │   │   ├── Pager.exe           # 主程序
│   │   │   └── ...                 # 其他应用文件
│   │   ├── Pager-0.0.9-setup.exe   # Inno Setup安装程序
│   │   ├── Pager-0.0.9-portable.exe # 便携版应用
│   │   └── ...                     # 其他构建产物
│   ├── installer.iss               # Inno Setup安装脚本
│   ├── build-inno.bat             # Inno Setup构建脚本
│   └── ...                         # 其他构建资源
├── src/                            # 源代码
└── ...                             # 其他项目文件
```

## 构建命令

### 1. 基础构建

```bash
yarn build
```

- 编译代码到 `build/out/` 目录
- 生成 main、preload、renderer 三个部分

### 2. 完整构建选项

```bash
yarn build:unpack      # 构建未打包版本到 build/dist/win-unpacked/
yarn build:portable   # 构建便携版到 build/dist/Pager-0.0.9-portable.exe
yarn build:inno       # 构建Inno Setup安装程序到 build/dist/
yarn build:all        # 构建便携版和安装程序
```

### 3. 开发和测试

```bash
yarn dev              # 开发模式
yarn start            # 预览构建的应用
```

## 配置文件

### electron.vite.config.ts

```typescript
renderer: {
  build: {
    outDir: resolve(__dirname, 'build/out/renderer'),
  }
}
```

### electron-builder.yml

```yaml
directories:
  buildResources: build
  output: build/dist

files:
  - 'build/out/**/*' # 包含编译后的代码

win:
  executableName: Pager
  target:
    - target: portable
      arch: [x64]
```

### build-inno.bat

```batch
set BUILD_DIR=build\dist
set OUTPUT_DIR=%BUILD_DIR%
iscc "%INNO_SCRIPT%" /DOUTPUT_DIR="%OUTPUT_DIR%"
```

### build/installer.iss

```pascal
OutputDir={#OUTPUT_DIR}  # 使用传递的变量
Source: "..\build\dist\win-unpacked\{#MyAppExeName}"
```

## 工作流程

### 1. 开发流程

```bash
yarn dev              # 开发应用
yarn build           # 构建应用到 build/out/
yarn build:unpack    # 生成可执行文件用于测试
```

### 2. 发布流程

```bash
yarn build:all       # 构建所有发布版本
```

- 生成便携版：`build/dist/Pager-0.0.9-portable.exe`
- 生成安装程序：`build/dist/Pager-0.0.9-setup.exe`

### 3. 验证和环境检查

```bash
.\verify-inno-fix.bat
```

- 检查构建环境
- 验证文件完整性
- 检查Inno Setup安装

### 4. 进程检测测试

```bash
powershell -ExecutionPolicy Bypass -File test-inno-detection.ps1
```

- 测试安装程序的进程检测逻辑
- 验证修复效果

## 目录结构优化

### 新的目录结构优势

- 🗂️ **统一构建目录**：所有构建相关文件都在 `build/` 下
- 📁 **清晰的分离**：
  - `build/out/` - 编译输出
  - `build/dist/` - 打包输出
- 🚀 **简化路径**：不再有根目录的 `out/` 文件夹
- 📦 **更好的组织**：构建产物集中管理

### 路径映射

| 旧路径                       | 新路径                             |
| ---------------------------- | ---------------------------------- |
| `out/main/index.js`          | `build/out/main/index.js`          |
| `out/preload/index.js`       | `build/out/preload/index.js`       |
| `dist/win-unpacked/`         | `build/dist/win-unpacked/`         |
| `dist/Pager-0.0.9-setup.exe` | `build/dist/Pager-0.0.9-setup.exe` |

## 故障排除

### 常见问题

1. **构建失败**：运行 `.\verify-inno-fix.bat` 检查环境
2. **路径错误**：确认 `build/out/` 和 `build/dist/` 都存在
3. **安装程序问题**：检查 `build/installer.iss` 配置
4. **进程检测问题**：运行 `test-inno-detection.ps1` 测试

### 清理构建文件

```bash
# 清理所有构建产物
rmdir /s build\out
rmdir /s build\dist

# 重新构建
yarn build:all
```
