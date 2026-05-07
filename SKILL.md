---
name: ai-memory-bridge
description: AI Memory Bridge — AI Coding Agent的执行记忆层。自动从每次工具调用中学习踩坑经验，在操作前注入相关经验并检测循环，让Agent越用越聪明。
origin: custom
version: 1.0.0
---

# AI Memory Bridge

AI Memory Bridge 是 Claude Code 的「执行记忆层」。它不替代你的思考，而是让 AI Agent 记住：

1. **什么操作会失败**（自动从 PostToolUse 中提取）
2. **什么方案更可靠**（踩坑后自动记录教训）
3. **何时该停下来**（循环检测 + 硬阻断）

## When to Activate

- 所有涉及工具调用（Bash, Read, Write, Edit, Grep 等）的编码任务
- 项目初始化时（`amb:init`）
- 感觉 AI 在重复踩坑时
- 需要查看或管理已学经验时

## Core Concepts

### 三层记忆

```
工作记忆（Session）  →  当前会话的工具调用历史
项目记忆（Project）  →  .ai-memory/ 目录，团队共享，提交到 git
全局记忆（Global）   →  ~/.claude/ai-memory/，跨项目复用
```

### 经验卡片（Experience Card）

```yaml
id: exp_abc123
type: pitfall           # pitfall | error | success | pattern | decision
scope: project          # project | global
confidence: 0.85        # 0.3-0.9
frequency: 3            # 被验证次数

trigger:
  tool: Bash
  action: npm install
  context: package.json modified

outcome:
  status: failure
  description: ERESOLVE dependency conflict
  consequences: [安装中断, 需手动干预]

lesson:
  what_worked: 添加 --legacy-peer-deps 标志
  what_failed: 直接安装不处理 peer dependency 冲突
  better_approach: 先检查 node 版本，再决定安装策略

metadata:
  tags: [npm, dependency, node]
  source_session: sess_xxx
  related: [exp_def456]
```

### 循环检测（Loop Detection）

当 AI 陷入以下模式时自动硬阻断：

| 循环类型 | 检测方式 | 阈值 |
|---------|---------|------|
| 精确重复 | 相同工具 + 相同输入 | 3 次 |
| 错误循环 | 相同工具 + 相同错误 | 3 次 |
| 序列循环 | 工具序列 A→B→C→A→B→C | 2 轮 |
| Token 空转 | 产出为空/错误，但 token 增长 | 5 次 |

**阻断输出**：
```
🛑 AI Memory Bridge: 检测到执行循环

循环类型：错误循环
工具：Bash (npm install)
尝试次数：3 次

历史经验：
├─ [高置信度] 该项目使用 --legacy-peer-deps 解决冲突
└─ [踩坑记录] 直接修改 package.json 后未同步 lock 文件

建议方案：
A. [推荐] 运行 `npm install --legacy-peer-deps`
B. 删除 node_modules 和 lock 文件后重新安装
C. 手动检查并升级冲突依赖

[输入 A/B/C/新指令继续]
```

## Commands

| Command | Description |
|---------|-------------|
| `/amb:init` | 扫描项目，生成 DNA 和经验目录 |
| `/amb:status` | 查看项目/全局经验统计和循环状态 |
| `/amb:learn "<描述>"` | 手动记录一条经验 |
| `/amb:search <关键词>` | 搜索经验库 |
| `/amb:forget <id>` | 删除或标记过时经验 |
| `/amb:loop` | 手动检查当前会话循环状态 |
| `/amb:promote <id>` | 将项目经验提升为全局经验 |
| `/amb:profile` | 查看/编辑开发者画像 |
| `/amb:dashboard` | 生成可视化仪表盘 HTML |
| `/amb:rules` | 将经验转换为 Skill 规则文件 |
| `/amb:ci-setup` | 生成 CI/CD 集成配置 |

## Rules

1. **PreToolUse 时**：
   - 先检测循环，发现则硬阻断并输出报告
   - 再匹配相关经验，注入上下文提醒
   - 对高风险操作（Write/Edit/Delete）给出后果预测

2. **PostToolUse 时**：
   - 自动分类结果（成功/失败/踩坑/新模式）
   - 值得记录时自动生成经验卡片
   - 基于技术栈判断存储范围（project vs global）

3. **SessionStart 时**：
   - 自动加载项目 DNA
   - 注入项目约束和活跃痛点
   - 加载开发者画像

4. **用户交互时**：
   - 阻断后必须等待用户明确输入才能继续
   - 经验注入使用非侵入式格式（💡 提示而非强制）
   - 所有自动记录的经验用户可事后 review/forget

## Quick Start

### 1. 初始化项目

```bash
/amb:init
```

扫描项目结构，生成：
- `.ai-memory/dna.json` — 项目技术栈和约束
- `.ai-memory/experiences/` — 项目经验存储目录

### 2. 查看状态

```bash
/amb:status
```

输出：
```
AI Memory Bridge Status
─────────────────────
Project: my-app (Next.js + TypeScript)
Project experiences: 12
Global experiences: 47
Session loops blocked: 2
Today's new learnings: 3
```

### 3. 手动记录经验

```bash
/amb:learn "使用 Prisma migrate dev 时要先确保数据库容器在运行"
```

### 4. 注册 Hooks

编辑 `~/.claude/settings.json`：

```json
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

## File Structure

```
~/.claude/skills/ai-memory-bridge/
├── SKILL.md
├── config.json
├── commands/
│   ├── init.mjs
│   ├── status.mjs
│   ├── learn.mjs
│   ├── search.mjs
│   ├── forget.mjs
│   ├── loop.mjs
│   ├── promote.mjs
│   └── profile.mjs
├── hooks/
│   ├── pre-tool.mjs
│   ├── post-tool.mjs
│   └── session-start.mjs
└── lib/
    ├── detect-project.mjs
    ├── experience-store.mjs
    ├── outcome-classifier.mjs
    ├── loop-detector.mjs
    └── context-builder.mjs

~/.claude/ai-memory/
├── config.json
├── global/
│   ├── experiences/
│   └── profile.json
└── projects/
    └── <project-hash>/
        ├── project.json
        ├── dna.json
        └── experiences/

./.ai-memory/ (项目内)
├── dna.json
└── experiences/
```

## Privacy

- 所有数据本地存储，不上传云端
- 经验记录不包含敏感信息（自动脱敏 API key、token、密码）
- 项目经验可选择提交到 git（团队共享）或保留本地

## Related

- continuous-learning-v2 — 学习习惯和本能
- ck (Context Keeper) — 会话状态保存
- gateguard — 事前事实核查

---

*让 AI 记住教训，而不是重复犯错。*
