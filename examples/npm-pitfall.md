# 示例：npm 踩坑记录

## 场景：npm install 失败

### 问题

```bash
$ npm install
npm ERR! ERESOLVE could not resolve
npm ERR! 
npm ERR! While resolving: react@18.2.0
npm ERR! Found: react@17.0.2
npm ERR! node_modules/react
npm ERR!   react@"^17.0.2" from the root project
npm ERR! 
npm ERR! Could not resolve dependency:
npm ERR! peer react@"^18.0.0" from some-package@1.0.0
```

### AI Memory Bridge 自动记录

```json
{
  "id": "exp_npm_001",
  "type": "pitfall",
  "scope": "project",
  "confidence": 0.66,
  "frequency": 3,
  "trigger": {
    "tool": "Bash",
    "action_pattern": "npm install",
    "context_pattern": "nodejs"
  },
  "outcome": {
    "status": "failure",
    "description": "ERESOLVE peer dependency conflict"
  },
  "lesson": {
    "what_failed": "直接运行 npm install 未处理 peer dependency 冲突",
    "what_worked": "添加 --legacy-peer-deps 标志后成功",
    "better_approach": "先检查 node 版本兼容性，再决定安装策略"
  }
}
```

### 解决方案

```bash
# 方案 1：使用 --legacy-peer-deps
npm install --legacy-peer-deps

# 方案 2：使用 --force
npm install --force

# 方案 3：手动解决冲突
# 1. 检查 package.json 中的依赖版本
# 2. 升级或降级冲突的依赖
# 3. 运行 npm install
```

### 预防措施

```bash
# 安装前检查
npm install --dry-run

# 查看依赖树
npm ls

# 检查过时的包
npm outdated
```

### 生成的规则

```markdown
## Rules
1. 先检查 node 版本兼容性，再决定安装策略
2. 添加 --legacy-peer-deps 标志
3. 不要直接运行 npm install 必须处理 peer dependency 冲突
```

## 场景：忘记同步 lock 文件

### 问题

团队成员 A 修改了 package.json，但没有提交 package-lock.json，导致团队成员 B 安装时版本不一致。

### 经验记录

```json
{
  "id": "exp_npm_002",
  "type": "pitfall",
  "lesson": {
    "what_failed": "修改 package.json 后未更新 package-lock.json",
    "better_approach": "运行 npm install 后提交 lock 文件"
  }
}
```

### 最佳实践

```bash
# 修改依赖后
git add package.json package-lock.json
git commit -m "chore: update dependencies"

# 或者使用钩子自动检查
# .git/hooks/pre-commit
if git diff --cached --name-only | grep -q "package.json"; then
  if ! git diff --cached --name-only | grep -q "package-lock.json"; then
    echo "⚠️  package.json modified but package-lock.json not updated"
    exit 1
  fi
fi
```
