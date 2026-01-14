# 依赖冲突解决文档

## 概述

本文档详细记录了 Pager 项目中遇到的一个复杂依赖冲突问题及其解决方案。该问题涉及多个包对同一依赖项（`ajv` 和 `env-paths`）的不同版本需求，导致构建失败和运行时错误。

## 问题背景

在项目开发过程中，我们遇到了一个复杂的依赖版本冲突问题，具体表现为：

1. `electron-store` 通过 `conf` 包需要 `ajv@^8.17.1` 和 `env-paths@^3.0.0`
2. `@electron/get` 需要 `env-paths@^2.2.0`
3. `@develar/schema-utils` 需要 `ajv@^6.12.0`

这种多重依赖需求导致了构建失败和运行时错误，特别是在 `conf` 包寻找 `ajv/dist/2020.js` 文件时出现模块未找到错误。

## 解决思路

面对这种复杂的依赖冲突，我们采用了以下解决策略：

1. **深入分析依赖关系**：首先彻底分析项目的依赖树，找出所有涉及冲突依赖的包及其版本需求。

2. **避免过度约束**：移除可能导致问题的 `resolutions` 配置，让包管理器自动解决依赖关系。

3. **利用嵌套依赖机制**：充分利用 npm/yarn 的嵌套依赖机制，允许不同包使用各自所需的依赖版本。

4. **验证解决方案**：通过构建和运行时测试验证解决方案的有效性。

## 具体解决方案

### 第一步：分析依赖关系

通过检查 `yarn.lock` 文件和各包的 `package.json`，我们确定了以下关键依赖关系：

- `electron-store@^11.0.2` → `conf@^15.0.2` → 需要 `ajv@^8.17.1` 和 `env-paths@^3.0.0`
- `@electron/get@^2.0.0` → 需要 `env-paths@^2.2.0`
- `app-builder-lib@26.4.0` → `@develar/schema-utils@~2.6.5` → 需要 `ajv@^6.12.0`

### 第二步：移除问题配置

移除了之前可能导致问题的 `resolutions` 配置，特别是那些试图强制统一 `ajv` 版本的配置。

### 第三步：重新生成依赖树

删除 `yarn.lock` 文件并重新运行 `yarn install`，让 Yarn 自动生成正确的依赖树：

```bash
# 删除 yarn.lock 文件
rm yarn.lock

# 重新安装依赖
yarn install
```

### 第四步：验证依赖版本

通过检查生成的 `yarn.lock` 文件和 `node_modules` 目录结构，确认依赖版本正确分配：

- 主项目使用 `ajv@6.12.6`（满足 `@develar/schema-utils` 的需求）
- `conf` 包使用 `ajv@8.17.1`（满足其自身需求，包含所需的 `2020.js` 文件）
- 使用 `env-paths@3.0.0`（满足 `conf` 包的需求）

验证命令：
```bash
# 检查 conf 包使用的 ajv 版本
cat node_modules/conf/node_modules/ajv/package.json | grep version

# 检查 2020.js 文件是否存在
ls node_modules/conf/node_modules/ajv/dist/2020.js
```

## 结果验证

通过以上解决方案，我们成功解决了依赖冲突问题：

1. `yarn install` 成功执行完成
2. `conf` 包现在正确使用 `ajv@8.17.1` 版本
3. `node_modules/conf/node_modules/ajv/dist/2020.js` 文件存在
4. `yarn build` 成功完成
5. 原始的 `Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'E:\System\Documents\GitHub\pager\node_modules\ajv\dist\2020.js'` 错误已解决

## 经验总结

1. **复杂依赖冲突需要细致分析**：面对多重依赖冲突，需要逐一分析每个包的具体需求，而不是简单地强制统一版本。

2. **合理利用嵌套依赖**：现代包管理器支持嵌套依赖，可以让不同包使用各自所需的版本，这是解决依赖冲突的重要手段。

3. **谨慎使用 resolutions**：虽然 `resolutions` 字段可以帮助解决一些依赖冲突，但在复杂情况下可能会引入新的问题。

4. **验证解决方案的重要性**：解决依赖冲突后，必须通过构建和运行时测试来验证解决方案的有效性。

## 后续注意事项

1. 在升级 `electron-store` 或相关依赖时，需要重新检查依赖关系，确保不会引入新的冲突。

2. 如果未来遇到类似的依赖冲突，可以参考本文档的解决思路和方法。

3. 建议定期检查项目的依赖关系，及时发现和解决潜在的冲突问题。