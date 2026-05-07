# AI Memory Bridge - 项目指导

## 项目概述

AI Memory Bridge 是 Claude Code 和 OpenClaw 的执行记忆层，让 AI Coding Agent 能够：
1. 从每次工具调用中学习经验
2. 在操作前注入历史教训
3. 检测并阻断执行循环
4. 生成可复用的 Skill 规则

## 技术栈

- **语言**: JavaScript (ESM, Node.js 18+)
- **存储**: JSON 文件（本地优先，零依赖）
- **架构**: Hooks + Commands + Libraries
- **测试**: 内置测试套件

## 核心概念

### 三层记忆

```
工作记忆（Session）  →  当前会话的工具调用历史
项目记忆（Project）  →  .ai-memory/ 目录，团队共享
全局记忆（Global）   →  ~/.claude/ai-memory/，跨项目复用
```

### 经验卡片

每个经验包含：
- **触发条件**: 工具名 + 输入模式
- **结果**: 成功/失败/踩坑
- **教训**: what_failed / what_worked / better_approach
- **元数据**: 置信度、频率、标签、验证历史

### 循环检测

四种检测维度：
1. 精确重复（相同工具 + 相同输入，3次）
2. 错误循环（相同工具 + 相同错误，3次）
3. 序列循环（A→B→C→A→B→C，2轮）
4. Token 空转（产出为空但消耗增长，5次）

## 代码规范

### 文件命名
- 使用 kebab-case：`detect-project.mjs`
- 测试文件前缀：`test-`
- 调试文件前缀：`debug-`

### 导出规范
- 核心函数使用 `export`
- 工具函数保持私有
- 避免循环依赖

### 错误处理
```javascript
try {
  // 操作
} catch (err) {
  if (process.env.AMB_DEBUG) {
    console.error('[AMB] Error:', err.message);
  }
  // 静默失败，不影响主流程
}
```

## 开发指南

### 添加新命令

1. 在 `commands/` 创建新文件
2. 使用 CLI 参数解析
3. 调用 lib 层函数
4. 添加测试用例

### 添加新 Hook

1. 在 `hooks/` 创建新文件
2. 从 stdin 读取 JSON 数据
3. 调用 lib 层逻辑
4. 输出 JSON 或退出码

### 添加新分析器

1. 在 `lib/` 创建新文件
2. 纯函数设计，无副作用
3. 提供 formatXxx 辅助函数
4. 更新 context-builder 集成

## 测试策略

```bash
# 单元测试
node test/test-loop-detector.mjs

# 集成测试
node test/test-all.mjs

# 功能测试
node test/test-features.mjs
```

## 发布流程

1. 更新版本号（config.json + package.json）
2. 运行完整测试套件
3. 更新 CHANGELOG.md
4. 创建 git tag
5. 推送到 GitHub

## 常见问题

### Q: 经验存储在哪里？
A: 项目级在 `.ai-memory/`，全局在 `~/.claude/ai-memory/`

### Q: 如何清理过期经验？
A: 使用 `/amb:forget <id>` 或设置 config.json 中的 cleanup_deprecated_after_days

### Q: 支持哪些 AI 工具？
A: Claude Code 和 OpenClaw。其他工具如果支持 hooks 系统也可以集成。

### Q: 团队如何共享经验？
A: 提交 `.ai-memory/` 目录到 git，团队成员自动获得共享经验。

## 架构图

```
AI Memory Bridge
├── lib/                    # 核心库
│   ├── detect-project      # 项目检测
│   ├── experience-store    # 存储 + 搜索
│   ├── outcome-classifier  # 结果分类
│   ├── loop-detector       # 循环检测
│   ├── context-builder     # 上下文构建
│   ├── dependency-analyzer # 依赖分析
│   ├── rule-generator      # 规则生成
│   └── ast-analyzer        # AST 分析
├── hooks/                  # 自动触发
│   ├── pre-tool            # 经验注入
│   ├── post-tool           # 自动学习
│   └── session-start       # DNA 加载
└── commands/               # 用户命令
    ├── init
    ├── status
    ├── learn
    ├── search
    ├── forget
    ├── loop
    ├── promote
    ├── profile
    ├── dashboard
    ├── rules
    └── ci-setup
```
