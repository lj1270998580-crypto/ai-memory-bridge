# AI Memory Bridge 🤖🧠

> **让 AI 记住教训，而不是重复犯错。**

AI Memory Bridge 是 Claude Code 和 OpenClaw 的 **执行记忆层**。它自动从每次工具调用中学习经验，在操作前注入历史教训，并在检测到循环时自动阻断，让 AI Coding Agent 越用越聪明。

## 🎬 快速演示

### 场景 1：避免重复踩坑

```bash
# 第 1 次
AI: npm install
     → 失败: ERESOLVE peer dependency conflict
     [自动记录经验]

# 第 2 次  
AI: npm install
     → 失败: ERESOLVE peer dependency conflict
     [自动记录经验]

# 第 3 次
AI: npm install
     → 🛑 检测到循环！已失败 3 次
     💡 历史经验：添加 --legacy-peer-deps 标志
     [强制暂停，等待用户选择]
```

### 场景 2：操作前提醒

```bash
你：修改 src/auth/login.ts

AI: 💡 AI Memory Bridge 提醒
     ├─ 该文件被 5 个模块引用
     ├─ 上次修改导致测试全部失败
     ├─ 影响范围：
     │   - src/api/login.ts:42
     │   - src/middleware/auth.ts:15
     │   - tests/auth.test.ts:30
     └─ 建议：先运行测试，再修改
```

### 场景 3：自然语言搜索

```bash
你：/amb:search "安装依赖出错"

AI: 🔍 找到 3 条相关经验
     
     1. [pitfall] npm install 冲突 (验证 3 次)
        ⚠️ 直接运行 npm install 未处理 peer dependency 冲突
        💡 添加 --legacy-peer-deps 标志
     
     2. [error] pip install 失败
        ⚠️ 权限不足
        💡 使用 pip install --user
     
     3. [pitfall] 忘记同步 lock 文件
        ⚠️ 修改 package.json 后未更新 package-lock.json
        💡 运行 npm install 后提交 lock 文件
```

## ✨ 核心功能

| 功能 | 说明 | 触发方式 |
|------|------|----------|
| **自动学习** | 从每次工具调用中提取经验 | PostToolUse Hook |
| **经验注入** | 操作前自动提醒相关历史 | PreToolUse Hook |
| **循环阻断** | 检测执行循环并强制暂停 | 自动检测 |
| **去重合并** | 相同踩坑合并，频率递增 | 自动处理 |
| **依赖分析** | 修改前分析影响范围 | Write/Edit 时 |
| **语义搜索** | 自然语言查询经验库 | `/amb:search` |
| **规则生成** | 经验自动转为 Skill 规则 | `/amb:rules` |
| **可视化** | HTML Dashboard 查看统计 | `/amb:dashboard` |
| **CI/CD** | GitHub Actions 集成 | `/amb:ci-setup` |

## 📦 安装

### 方式 1：Claude Code（推荐）

```bash
# 1. 安装 Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 2. 克隆本仓库到 skills 目录
git clone https://github.com/lj1270998580-crypto/ai-memory-bridge.git \
  ~/.claude/skills/ai-memory-bridge

# 3. 配置 hooks（在 ~/.claude/settings.json 中添加）
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/ai-memory-bridge/hooks/pre-tool.mjs"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/ai-memory-bridge/hooks/post-tool.mjs"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/ai-memory-bridge/hooks/session-start.mjs"
          }
        ]
      }
    ]
  }
}
```

### 方式 2：OpenClaw

```bash
# 运行配置脚本
node ~/.claude/skills/ai-memory-bridge/setup-openclaw.mjs
```

### 方式 3：手动安装

```bash
# 1. 下载代码
git clone https://github.com/lj1270998580-crypto/ai-memory-bridge.git
cd ai-memory-bridge

# 2. 初始化你的项目
node commands/init.mjs

# 3. 使用命令
node commands/status.mjs
```

## 🚀 快速开始

### 1. 初始化项目

```bash
cd your-project
/amb:init
```

输出：
```
🔧 AI Memory Bridge: Initializing...

Project: my-app
ID: proj_a1b2c3d4

✅ Generated DNA:
  Name: my-app
  Stack: Next.js, TypeScript, Prisma
  Goal: 

📁 Created:
  .ai-memory/dna.json
  .ai-memory/experiences/

🚀 Ready! Hooks will automatically learn from tool executions.
```

### 2. 正常使用 AI 编码

AI 会自动记录每次踩坑。例如：

```bash
# AI 运行命令
AI: npm install
    → 失败: ERESOLVE could not resolve

# [PostToolUse Hook 自动记录]
# ✅ Learned: exp_xxx (pitfall, project)
#    Lesson: 直接运行 npm install 未处理 peer dependency 冲突
```

### 3. 查看状态

```bash
/amb:status
```

输出：
```
🧠 AI Memory Bridge Status
═══════════════════════════════════════

Project: my-app
ID: proj_a1b2c3d4
Local Storage: ✅

📚 Experience Library
  Project: 5 experiences
  Global:  12 experiences

📊 Current Session
  Tool Calls: 23
  Unique Tools: 5
  Failure Rate: 15.2%
  Loops Blocked: 1

📝 Recent Learnings
  🔴 [freq:3] npm install 冲突
  🟡 [freq:2] git push 被拒绝
  🟢 [freq:1] 测试配置成功
```

### 4. 搜索经验

```bash
# 关键词搜索
/amb:search npm

# 语义搜索（支持自然语言）
/amb:search "安装依赖出错"

# 过滤搜索
/amb:search npm --type pitfall
/amb:search --tool Bash --tag docker
```

### 5. 生成可视化仪表盘

```bash
/amb:dashboard
```

生成 `ai-memory-dashboard.html`，用浏览器打开即可查看：

- 统计卡片（总数、踩坑、错误、模式）
- 踩坑排行榜 TOP 10
- 置信度排行榜 TOP 10
- 经验列表（支持搜索、过滤、排序）

### 6. 生成规则文件

```bash
/amb:rules
```

输出到 `.ai-memory/rules/`：

```
📁 .ai-memory/rules/
├── README.md
└── pitfall-avoidance/
    └── amb-rule-xxx.md
```

规则文件可以直接复制到 Claude Code skills 目录：

```bash
cp -r .ai-memory/rules/* ~/.claude/skills/
```

### 7. 设置 CI/CD

```bash
/amb:ci-setup
```

生成 `.github/workflows/`：

```
📁 .github/workflows/
├── ai-memory.yml              # 自动学习 CI 失败
└── ai-memory-pr-check.yml     # PR 踩坑检查
```

## 📖 详细示例

### 示例 1：记录 npm 踩坑经验

```bash
# 第 1 次踩坑
AI: npm install
    → ❌ 失败: ERESOLVE peer dependency conflict
    
# 第 2 次踩坑（AI 可能重试）
AI: npm install
    → ❌ 失败: ERESOLVE peer dependency conflict
    
# 第 3 次（AI 再次尝试）
AI: npm install
    → ❌ 失败: ERESOLVE peer dependency conflict
    → 🛑 AI Memory Bridge: 检测到执行循环！
    
    循环类型：错误循环
    工具：Bash (npm install)
    尝试次数：3 次
    
    历史经验：
    ├─ [高置信度] 该项目使用 --legacy-peer-deps 解决冲突
    └─ [踩坑记录] 直接修改 package.json 后未同步 lock 文件
    
    建议方案：
    A. [推荐] 运行 npm install --legacy-peer-deps
    B. 删除 node_modules 和 lock 文件后重新安装
    C. 手动检查并升级冲突依赖
    
    [输入 A/B/C/新指令继续]

# 用户选择 A
你：A

# 成功！
AI: npm install --legacy-peer-deps
    → ✅ 成功！
    
# 自动记录成功经验
# [PostToolUse Hook]
# ✅ Learned: exp_yyy (pattern, project)
#    Lesson: 使用 --legacy-peer-deps 解决 peer dependency 冲突
```

### 示例 2：修改文件前的影响分析

```bash
你：修改 src/auth/login.ts

# [PreToolUse Hook]
# AI Memory Bridge 自动分析...

AI: 💡 AI Memory Bridge: 经验提醒

     相关经验：
       ● [中置信度 · 踩坑1次] 上次修改验证逻辑导致登录测试全部失败
         → 建议：修改前运行测试确认当前状态
     
     代码影响分析:
       📊 src/auth/login.ts
       ├─ 导出函数: login(), logout(), refreshToken()
       ├─ 影响 5 个引用位置
       │   → src/api/login.ts:42
       │   → src/middleware/auth.ts:15
       │   → src/services/user.ts:88
       │   → tests/auth.test.ts:30
       │   → tests/login.test.ts:15
       ├─ 🔐 安全相关文件，修改可能影响认证/授权逻辑
       └─ ✅ 发现 2 个相关测试文件
     
     可能后果：
       🟡 文件修改可能影响依赖该文件的其他模块
          → 缓解：修改前搜索引用关系，同步更新关联文件
       🟡 接口修改将导致所有实现该接口的代码报错
          → 缓解：运行相关测试验证修改
     
     建议执行路径：
       1. 先运行测试确认当前状态：npm test -- auth
       2. 使用 MultiEdit 同时修改关联文件
       3. 修改后重新运行测试
```

### 示例 3：自然语言搜索

```bash
# 搜索"安装依赖"
/amb:search "安装依赖"

🔍 Found 2 experience(s) for "安装依赖" (semantic match)

1. 🔴 🌐 exp_xxx
   Relevance: 85% | Confidence: 66% | Frequency: 3
   Tool: Bash
   Action: {"command":"npm install"}
   Outcome: ERESOLVE
   ⚠️  直接运行 npm install 未处理 peer dependency 冲突
   💡 添加 --legacy-peer-deps 标志
   🏷️  bash, npm, failure, pitfall

2. 🟡 📁 exp_yyy
   Relevance: 72% | Confidence: 50% | Frequency: 1
   Tool: Bash
   Action: {"command":"pip install"}
   Outcome: Permission denied
   ⚠️  权限不足
   💡 使用 pip install --user
   🏷️  bash, pip, failure, error

# 搜索"构建失败"
/amb:search "构建失败"

🔍 Found 1 experience(s) for "构建失败" (semantic match)

1. 🔴 📁 exp_zzz
   Relevance: 78% | Confidence: 75% | Frequency: 2
   Tool: Bash
   Action: {"command":"npm run build"}
   Outcome: TypeScript compilation error
   ⚠️  TypeScript 严格模式导致构建失败
   💡 检查 tsconfig.json 的 strict 选项
   🏷️  bash, build, typescript, failure
```

### 示例 4：团队协作

```bash
# 成员 A 踩坑并记录
/amb:learn "不要用 rm -rf /" pitfall safety

# 提交到仓库
git add .ai-memory/
git commit -m "chore: add safety pitfall experience"
git push

# 成员 B 克隆仓库
git clone https://github.com/team/project.git
cd project

# AI 自动加载团队经验
# 当 B 尝试 rm -rf 时：
AI: 🛑 检测到危险操作！
    
    历史经验：
    ├─ [高置信度] 不要用 rm -rf /
    └─ [团队共享] 成员 A 于 2024-01-15 记录
    
    可能后果：
       🔴 破坏性操作，可能导致数据丢失
          → 缓解：先备份，或使用 --dry-run 预览影响
    
    确认执行？ (yes/no)
```

### 示例 5：CI/CD 自动学习

```bash
# 1. 设置 CI
/amb:ci-setup

# 2. 提交配置
git add .github/workflows/
git commit -m "chore: add AI Memory Bridge CI"
git push

# 3. 在 PR 中，CI 自动检查
# GitHub Actions 评论：
🤖 AI Memory Bridge: Relevant Experiences

⚠️ PITFALL (85% confidence)
   直接运行 npm install 未处理 peer dependency 冲突
   💡 添加 --legacy-peer-deps 标志

⚠️ ERROR (70% confidence)
   git push 前未 pull
   💡 先 git pull，再 git push

⚠️ PATTERN (90% confidence)
   修改 auth 文件需同步更新测试
   💡 运行 npm test -- auth
```

### 示例 6：规则生成与使用

```bash
# 生成规则
/amb:rules

输出：
📝 AI Memory Bridge: Generating Skill Rules

Project: my-app
Output: .ai-memory/rules
Criteria: freq >= 2, conf >= 60%

✅ Generated 3 rule(s)

Generated files:
  📄 .ai-memory/rules/README.md
  
  📁 pitfall-avoidance/
     amb-rule-xxx.md - npm规范
     amb-rule-yyy.md - git规范
  
  📁 code-style/
     amb-rule-zzz.md - TypeScript规范

# 查看生成的规则
cat .ai-memory/rules/pitfall-avoidance/amb-rule-xxx.md
```

规则内容示例：
```markdown
---
name: amb-rule-xxx
description: 直接运行 npm install 未处理 peer dependency 冲突
category: pitfall-avoidance
confidence: 66%
frequency: 3
---

# npm规范

## When to Apply
- 使用 Bash 工具时
- 执行 npm 操作时
- 在 nodejs 环境下

## Rules
1. 先检查 node 版本兼容性，再决定安装策略
2. 添加 --legacy-peer-deps 标志
3. 不要直接运行 npm install 必须处理 peer dependency 冲突

## Examples

❌ Bad:
```bash
npm install
```

## Rationale
This rule was automatically generated from 3 observed instance(s) 
with 66% confidence.
```

## 📁 项目结构

```
ai-memory-bridge/
├── README.md              # 本文件
├── SKILL.md               # Claude Code Skill 定义
├── CLAUDE.md              # 项目 AI 指导文件
├── config.json            # 默认配置
├── .gitignore             # Git 忽略规则
├── setup-openclaw.mjs     # OpenClaw 配置脚本
│
├── lib/                   # 核心库（8个模块）
│   ├── detect-project.mjs      # 项目检测
│   ├── experience-store.mjs    # 存储 + 语义搜索
│   ├── outcome-classifier.mjs  # 结果分类
│   ├── loop-detector.mjs       # 循环检测
│   ├── context-builder.mjs     # 上下文构建
│   ├── dependency-analyzer.mjs # 依赖分析
│   ├── rule-generator.mjs      # 规则生成
│   └── ast-analyzer.mjs        # AST 分析
│
├── hooks/                 # 自动触发钩子（3个）
│   ├── pre-tool.mjs       # PreToolUse: 经验注入 + 循环检测
│   ├── post-tool.mjs      # PostToolUse: 自动学习
│   └── session-start.mjs  # SessionStart: 加载 DNA
│
├── commands/              # 命令脚本（11个）
│   ├── init.mjs           # 初始化
│   ├── status.mjs         # 状态查看
│   ├── learn.mjs          # 手动记录
│   ├── search.mjs         # 搜索（支持语义）
│   ├── forget.mjs         # 删除经验
│   ├── loop.mjs           # 循环检查
│   ├── promote.mjs        # 提升全局
│   ├── profile.mjs        # 开发者画像
│   ├── dashboard.mjs      # 生成仪表盘
│   ├── rules.mjs          # 生成规则
│   └── ci-setup.mjs       # CI/CD 配置
│
├── test/                  # 测试套件
│   ├── test-post-tool.mjs # 自动学习测试
│   ├── test-loop-detector.mjs # 循环检测测试
│   ├── test-features.mjs  # 新功能测试
│   └── test-all.mjs       # 完整集成测试
│
└── examples/              # 使用示例
    ├── npm-pitfall.md     # npm 踩坑示例
    ├── git-workflow.md    # Git 工作流示例
    └── typescript.md      # TypeScript 示例
```

## 🛠️ 命令参考

| 命令 | 功能 | 示例 |
|------|------|------|
| `/amb:init` | 初始化项目 | `/amb:init` |
| `/amb:status` | 查看统计 | `/amb:status` |
| `/amb:learn` | 手动记录 | `/amb:learn "不要用 rm -rf /"` |
| `/amb:search` | 搜索（语义） | `/amb:search npm` |
| `/amb:search` | 自然语言 | `/amb:search "安装依赖出错"` |
| `/amb:forget` | 删除经验 | `/amb:forget exp_xxx` |
| `/amb:loop` | 检查循环 | `/amb:loop` |
| `/amb:promote` | 提升全局 | `/amb:promote exp_xxx` |
| `/amb:profile` | 开发者画像 | `/amb:profile` |
| `/amb:dashboard` | 生成仪表盘 | `/amb:dashboard` |
| `/amb:rules` | 生成规则 | `/amb:rules` |
| `/amb:ci-setup` | CI/CD 配置 | `/amb:ci-setup` |

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

## 🤝 贡献指南

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 许可证

MIT License

---

**让 AI 记住教训，而不是重复犯错。** 🎉
