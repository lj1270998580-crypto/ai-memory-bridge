# AI Memory Bridge 🤖🧠

AI Coding Agent 的执行记忆层。让 AI 记住踩过的坑，避免重复犯错。

## ✨ 核心功能

- **自动学习** — 从每次工具调用中提取踩坑经验（PostToolUse Hook）
- **经验注入** — 操作前自动提醒相关历史教训（PreToolUse Hook）
- **循环阻断** — 检测到执行循环时硬阻断并给出建议
- **去重合并** — 相同踩坑自动合并，频率/置信度递增
- **依赖分析** — 修改文件前分析影响范围（AST + Import分析）
- **语义搜索** — 自然语言查询经验库（中文支持）
- **规则生成** — 将经验自动转为 Skill 规则文件
- **可视化** — HTML Dashboard 查看统计和排行榜
- **CI/CD 集成** — GitHub Actions 自动学习 + PR 检查

## 📦 安装

### 方式 1：Claude Code（推荐）

```bash
# 安装 Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 克隆本仓库到 skills 目录
cd ~/.claude/skills
git clone https://github.com/yourname/ai-memory-bridge.git

# 配置 hooks
echo '{
  "hooks": {
    "PreToolUse": [{"matcher": "*", "hooks": [{"type": "command", "command": "node ~/.claude/skills/ai-memory-bridge/hooks/pre-tool.mjs"}]}],
    "PostToolUse": [{"matcher": "*", "hooks": [{"type": "command", "command": "node ~/.claude/skills/ai-memory-bridge/hooks/post-tool.mjs"}]}],
    "SessionStart": [{"hooks": [{"type": "command", "command": "node ~/.claude/skills/ai-memory-bridge/hooks/session-start.mjs"}]}]
  }
}' > ~/.claude/settings.json
```

### 方式 2：OpenClaw

```bash
# 配置命令
node ~/.claude/skills/ai-memory-bridge/setup-openclaw.mjs
```

## 🚀 快速开始

```bash
# 进入你的项目
cd your-project

# 初始化 AI Memory Bridge
/amb:init

# 正常使用 AI 编码
# AI 会自动记住每次踩坑

# 查看状态
/amb:status

# 生成可视化仪表盘
/amb:dashboard

# 自然语言搜索经验
/amb:search "安装依赖出错"

# 生成规则文件
/amb:rules

# 设置 CI/CD
/amb:ci-setup
```

## 📊 效果示例

**场景**：AI 重复踩坑

```
AI: 运行 npm install → 失败
AI: 运行 npm install → 失败
AI: 运行 npm install → 🛑 自动阻断！
    "检测到循环：npm install 已失败3次"
    "历史经验：使用 --legacy-peer-deps 解决"
```

**场景**：操作前提醒

```
你：修改 src/auth/login.ts
AI：💡 提醒："该文件被5处引用，上次修改导致测试失败"
```

## 📁 项目结构

```
ai-memory-bridge/
├── SKILL.md              # Skill 定义
├── config.json           # 默认配置
├── lib/                  # 核心库
│   ├── detect-project.mjs
│   ├── experience-store.mjs    # 存储 + 语义搜索
│   ├── outcome-classifier.mjs
│   ├── loop-detector.mjs
│   ├── context-builder.mjs
│   ├── dependency-analyzer.mjs
│   ├── rule-generator.mjs
│   └── ast-analyzer.mjs
├── hooks/                # 自动触发钩子
│   ├── pre-tool.mjs      # 经验注入 + 循环检测
│   ├── post-tool.mjs     # 自动学习
│   └── session-start.mjs # 加载DNA
├── commands/             # 命令脚本
│   ├── init.mjs
│   ├── status.mjs
│   ├── learn.mjs
│   ├── search.mjs
│   ├── forget.mjs
│   ├── loop.mjs
│   ├── promote.mjs
│   ├── profile.mjs
│   ├── dashboard.mjs
│   ├── rules.mjs
│   └── ci-setup.mjs
└── test/                 # 测试套件
```

## 🛠️ 命令参考

| 命令 | 功能 | 示例 |
|------|------|------|
| `/amb:init` | 初始化项目 | `amb-init` |
| `/amb:status` | 查看统计 | `amb-status` |
| `/amb:learn` | 手动记录经验 | `amb-learn "不要用 rm -rf /"` |
| `/amb:search` | 搜索经验（语义） | `amb-search npm` |
| `/amb:search` | 自然语言查询 | `amb-search "安装依赖出错"` |
| `/amb:forget` | 删除经验 | `amb-forget exp_xxx` |
| `/amb:loop` | 检查循环状态 | `amb-loop` |
| `/amb:promote` | 提升为全局经验 | `amb-promote exp_xxx` |
| `/amb:profile` | 开发者画像 | `amb-profile` |
| `/amb:dashboard` | 生成 HTML 仪表盘 | `amb-dashboard` |
| `/amb:rules` | 生成 Skill 规则 | `amb-rules` |
| `/amb:ci-setup` | 生成 CI/CD 配置 | `amb-ci-setup` |

## 🔄 工作原理

```
用户操作
  │
  ├── PreToolUse ──→ 循环检测 ──→ 经验匹配 ──→ 后果预测 ──→ 💡 提醒/🛑 阻断
  │
  ├── 工具执行 ──→ 成功/失败
  │
  └── PostToolUse ──→ 结果分类 ──→ 经验提取 ──→ 去重合并 ──→ 💾 存储
```

## 📦 存储结构

```
~/.claude/ai-memory/           # 全局（跨项目复用）
└── projects/
    └── <project-hash>/
        └── experiences/

./.ai-memory/                   # 项目级（提交到git，团队共享）
├── dna.json                    # 项目DNA
├── experiences/                # 项目经验
└── rules/                      # 生成的规则
```

## 🧪 测试

```bash
# 运行完整测试套件
node test/test-all.mjs

# 测试特定功能
node test/test-post-tool.mjs    # 自动学习
node test/test-loop-detector.mjs # 循环检测
node test/test-features.mjs      # 新功能
```

## 🤝 团队协作

```bash
# 提交经验到仓库
git add .ai-memory/
git commit -m "chore: update AI learned experiences"
git push

# 团队成员克隆后自动获得
# AI 会遵守团队的共享规则
```

## 📄 许可证

MIT License

---

**让 AI 记住教训，而不是重复犯错。**
