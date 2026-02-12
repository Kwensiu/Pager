# GitHub Scripts

This directory contains scripts used by GitHub Actions workflows.

## generate-release-notes.ts

A beautiful release notes generator that:

- Automatically fetches commits since the last tag
- Categorizes commits by type (Features, Bug Fixes, UI/UX, etc.)
- Generates statistics and contributor information
- Creates formatted Markdown with emojis and Chinese text
- Provides installation instructions

### Usage

```bash
pnpm release-notes <version>
```

### Features

- **Smart Categorization**: Automatically categorizes commits based on keywords
- **Beautiful Formatting**: Uses emojis and structured Markdown
- **Statistics**: Shows commit count and categories involved
- **Contributors**: Lists all contributors in the release
- **Installation Guide**: Includes platform-specific installation instructions
- **Chinese Localization**: Uses Chinese text for better user experience

### Categories

- 🚀 Features (feat, feature, add, new, implement, introduce)
- 🐛 Bug Fixes (fix, bug, issue, error, crash, resolve)
- 💄 UI/UX (ui, ux, design, style, layout, component, theme)
- 🔧 Configuration (config, setting, option, env, build, script)
- 📝 Documentation (doc, readme, md, comment, guide, tutorial)
- ⚡ Performance (perf, performance, optimize, speed, fast, slow)
- 🔒 Security (security, auth, permission, vulnerability, secure)
- 🧪 Testing (test, spec, unit, e2e, coverage)
- 🔄 Refactoring (refactor, cleanup, organize, structure, improve)
- 📦 Dependencies (dep, dependency, package, npm, pnpm, update, upgrade)
- 🗑️ Removed (remove, delete, drop, deprecate)
- 🔀 Merged (merge, pr, pull request)
- 📋 Other (fallback category)

The script is integrated into the release workflow and automatically generates release notes for each new version.
