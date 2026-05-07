# 贡献指南

感谢您对 AI Memory Bridge 的兴趣！我们欢迎各种形式的贡献。

## 如何贡献

### 报告 Bug

1. 检查是否已有相关 Issue
2. 创建新 Issue，包含：
   - 问题描述
   - 复现步骤
   - 预期行为 vs 实际行为
   - 环境信息（Node.js 版本、操作系统）
   - 相关日志或截图

### 提交功能请求

1. 描述功能的使用场景
2. 解释为什么现有功能无法满足
3. 提供可能的实现思路（可选）

### 提交代码

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建 Pull Request

## 开发环境

### 前置要求

- Node.js 18+
- Git

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/lj1270998580-crypto/ai-memory-bridge.git
cd ai-memory-bridge

# 运行测试
node test/test-all.mjs

# 测试单个功能
node test/test-loop-detector.mjs
```

## 代码规范

### 提交信息格式

使用 Conventional Commits：

```
type(scope): description

[optional body]

[optional footer]
```

类型：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具链

示例：
```
feat(semantic-search): add synonym expansion

Implement synonym map for common development terms.
Supports Chinese and English queries.

Closes #123
```

### 代码风格

- 使用 2 空格缩进
- 使用单引号
- 行尾不加逗号
- 最大行宽 100
- 使用 ESM (`import`/`export`)

### 文件组织

```
lib/
  feature-name.mjs       # 核心逻辑
  feature-name.test.mjs  # 测试文件

commands/
  feature.mjs            # CLI 命令

test/
  test-feature.mjs       # 集成测试
```

## 测试要求

### 必须测试的场景

1. **新 Hook**: 测试触发条件和输出格式
2. **新命令**: 测试参数解析和输出
3. **新分析器**: 测试各种输入和边界条件
4. **修改现有功能**: 确保向后兼容

### 测试结构

```javascript
// test/test-feature.mjs

import { testFunction } from '../lib/feature.mjs';

console.log('🧪 Testing Feature\n');

// Test 1: Basic case
{
  const result = testFunction('input');
  console.assert(result.expected === true, 'Test 1 failed');
  console.log('✅ Test 1 passed');
}

// Test 2: Edge case
{
  const result = testFunction('');
  console.assert(result !== null, 'Test 2 failed');
  console.log('✅ Test 2 passed');
}
```

## 文档更新

修改代码时，请同时更新：

1. **README.md**: 如果修改了用户可见的功能
2. **SKILL.md**: 如果修改了命令或 hooks
3. **CLAUDE.md**: 如果修改了架构或开发流程
4. **examples/**: 如果添加了新场景

## 发布流程

维护者发布新版本时：

1. 更新 `config.json` 中的版本号
2. 更新 CHANGELOG.md
3. 创建 git tag：`git tag v1.0.0`
4. 推送到 GitHub：`git push origin main --tags`
5. 创建 GitHub Release

## 社区规范

- 尊重他人，保持友善
- 接受建设性批评
- 关注项目目标
- 欢迎新人

## 获取帮助

- 查看 [README.md](README.md)
- 查看 [CLAUDE.md](CLAUDE.md)
- 创建 Issue 提问
- 加入讨论

## 许可证

贡献即表示您同意将代码以 MIT 许可证发布。
