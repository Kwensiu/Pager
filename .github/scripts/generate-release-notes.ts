#!/usr/bin/env node

import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'

// ANSI color codes for beautiful terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
}

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`
}

interface Commit {
  hash: string
  message: string
  author: string
  date: string
}

interface CommitRange {
  latestTag: string | null
  commits: string[]
}

interface Categories {
  [category: string]: Commit[]
}

function getCommitsSinceLastTag(customTag?: string): CommitRange {
  try {
    // Use custom tag if provided, otherwise get the latest tag
    const comparisonTag =
      customTag || execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim()
    console.log(colorize(`📦 Comparison tag: ${comparisonTag}`, 'cyan'))

    // Get commits since the comparison tag
    const commits = execSync(
      `git log ${comparisonTag}..HEAD --pretty=format:"%H|%s|%an|%ad" --date=short`,
      { encoding: 'utf8' }
    )
      .trim()
      .split('\n')
      .filter((line) => line)

    return { latestTag: customTag ? null : comparisonTag, commits }
  } catch {
    // If no tags exist, get all commits
    console.log(colorize('⚠️  No tags found, getting all commits', 'yellow'))
    const commits = execSync('git log --pretty=format:"%H|%s|%an|%ad" --date=short', {
      encoding: 'utf8'
    })
      .trim()
      .split('\n')
      .filter((line) => line)

    return { latestTag: null, commits }
  }
}

function categorizeCommits(commits: string[]): Categories {
  const categories: Categories = {
    '🚀 新功能': [],
    '🐛 修复': [],
    '💄 UI/UX': [],
    '🔧 配置': [],
    '📝 文档': [],
    '⚡ 性能': [],
    '🔒 安全': [],
    '🧪 测试': [],
    '🔄 重构': [],
    '📦 依赖': [],
    '🗑️ 删除': [],
    '🔀 合并': [],
    '📋 其他': []
  }

  const featureKeywords = ['feat', 'feature', 'add', 'new', 'implement', 'introduce']
  const bugKeywords = ['fix', 'bug', 'issue', 'error', 'crash', 'resolve']
  const uiKeywords = ['ui', 'ux', 'design', 'style', 'layout', 'component', 'theme']
  const configKeywords = ['config', 'setting', 'option', 'env', 'build', 'script']
  const docsKeywords = ['doc', 'readme', 'md', 'comment', 'guide', 'tutorial']
  const perfKeywords = ['perf', 'performance', 'optimize', 'speed', 'fast', 'slow']
  const securityKeywords = ['security', 'auth', 'permission', 'vulnerability', 'secure']
  const testKeywords = ['test', 'spec', 'unit', 'e2e', 'coverage']
  const refactorKeywords = ['refactor', 'cleanup', 'organize', 'structure', 'improve']
  const depsKeywords = ['dep', 'dependency', 'package', 'npm', 'pnpm', 'update', 'upgrade']
  const removeKeywords = ['remove', 'delete', 'drop', 'deprecate']
  const mergeKeywords = ['merge', 'pr', 'pull request']

  commits.forEach((commit) => {
    const [hash, message, author, date] = commit.split('|')
    const lowerMessage = message.toLowerCase()

    let category = '📋 其他'

    if (featureKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '🚀 新功能'
    } else if (bugKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '🐛 修复'
    } else if (uiKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '💄 UI/UX'
    } else if (configKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '🔧 配置'
    } else if (docsKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '📝 文档'
    } else if (perfKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '⚡ 性能'
    } else if (securityKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '🔒 安全'
    } else if (testKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '🧪 测试'
    } else if (refactorKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '🔄 重构'
    } else if (depsKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '📦 依赖'
    } else if (removeKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '🗑️ 删除'
    } else if (mergeKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      category = '🔀 合并'
    }

    categories[category].push({ hash: hash.substring(0, 7), message, author, date })
  })

  return categories
}

function generateReleaseNotes(
  version: string,
  categories: Categories,
  latestTag: string | null
): string {
  const date = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  let notes = `# 🎉 Pager ${version}\n\n`

  // Add beta warning if version contains beta
  if (version.includes('beta')) {
    notes += `## 🚧 Beta 版本发布\n\n`
    notes += `⚠️ **这是自动构建的测试版本，可能存在未知问题，仅供测试使用。**\n\n`
    notes += `---\n\n`
  }

  notes += `> 📅 发布日期: ${date}\n`
  notes += `> 🔗 比较范围: ${latestTag ? `${latestTag} → HEAD` : '初始提交'}\n\n`

  // Summary statistics
  const totalCommits = Object.values(categories).reduce((sum, commits) => sum + commits.length, 0)
  notes += `## 📊 统计信息\n\n`
  notes += `- 📝 **总提交数**: ${totalCommits}\n`
  notes += `- 🏷️  **涉及类别**: ${Object.values(categories).filter((c) => c.length > 0).length}\n\n`

  // Generate categorized changes
  let hasChanges = false
  for (const [category, commits] of Object.entries(categories)) {
    if (commits.length > 0) {
      hasChanges = true
      notes += `## ${category}\n\n`

      commits.forEach((commit) => {
        notes += `- **${commit.message}** (${commit.hash}) - ${commit.author}\n`
      })

      notes += '\n'
    }
  }

  if (!hasChanges) {
    notes += `## 📋 变更内容\n\n`
    notes += `暂无变更记录\n\n`
  }

  // Add contributors section
  const contributors = new Set<string>()
  Object.values(categories).forEach((commits) => {
    commits.forEach((commit) => contributors.add(commit.author))
  })

  if (contributors.size > 0) {
    notes += `## 👥 贡献者\n\n`
    Array.from(contributors).forEach((contributor) => {
      notes += `- 🙌 ${contributor}\n`
    })
    notes += '\n'
  }

  // Add installation instructions
  notes += `---\n`
  notes += `## 🚀 安装指南\n\n`
  notes += `### Windows\n`
  notes += `1. 下载 \`.exe\` 安装包\n`
  notes += `2. 双击运行安装程序\n`
  notes += `3. 按照向导完成安装\n\n`

  notes += `### 使用方法\n`
  notes += `- 启动 Pager 应用程序\n`
  notes += `- 开始管理您的多个网站\n\n`

  // Footer
  notes += `---\n`
  notes += `🎊 感谢您使用 Pager！如有问题请提交 [Issue](https://github.com/Kwensiu/Pager/issues)\n`

  return notes
}

function main(): void {
  try {
    console.log(colorize('🚀 Generating release notes...', 'bright'))

    const version = process.argv[2]
    if (!version) {
      console.error(colorize('❌ Version is required', 'red'))
      process.exit(1)
    }

    // Optional: custom comparison tag
    const comparisonTag = process.argv[3]

    console.log(colorize(`📋 Generating notes for version ${version}`, 'blue'))
    if (comparisonTag) {
      console.log(colorize(`🔗 Using custom comparison tag: ${comparisonTag}`, 'yellow'))
    }

    const { latestTag, commits } = getCommitsSinceLastTag(comparisonTag)
    console.log(colorize(`📊 Found ${commits.length} commits`, 'green'))

    if (commits.length === 0) {
      console.log(colorize('⚠️  No commits found since last tag', 'yellow'))
    }

    const categories = categorizeCommits(commits)
    const releaseNotes = generateReleaseNotes(version, categories, comparisonTag || latestTag)

    // Write to file
    const outputPath = join(process.cwd(), 'RELEASE_NOTES.md')
    writeFileSync(outputPath, releaseNotes, 'utf8')

    console.log(colorize(`✅ Release notes generated successfully!`, 'green'))
    console.log(colorize(`📁 Output: ${outputPath}`, 'cyan'))

    // Also output to console for GitHub Actions
    console.log('\n' + '='.repeat(50))
    console.log('📝 RELEASE NOTES PREVIEW:')
    console.log('='.repeat(50) + '\n')
    console.log(releaseNotes)
  } catch (error) {
    console.error(colorize('❌ Error generating release notes:', 'red'), (error as Error).message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
