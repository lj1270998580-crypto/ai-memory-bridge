# 示例：Git 工作流踩坑

## 场景：git push 被拒绝

### 问题

```bash
$ git push origin main
! [rejected]        main -> main (fetch first)
error: failed to push some refs to 'github.com:user/repo.git'
hint: Updates were rejected because the remote contains work that you do
hint: not have locally. This is usually caused by another repository pushing to
hint: the same ref.
```

### 原因

远程仓库有更新，本地分支落后于远程。

### AI Memory Bridge 记录

```json
{
  "id": "exp_git_001",
  "type": "pitfall",
  "trigger": {
    "tool": "Bash",
    "action_pattern": "git push origin main"
  },
  "outcome": {
    "status": "failure",
    "description": "rejected - remote contains work not locally"
  },
  "lesson": {
    "what_failed": "直接 push 未先 pull 远程更新",
    "what_worked": "先 git pull，再 git push",
    "better_approach": "推送前先拉取更新，或使用 git push --force-with-lease"
  }
}
```

### 解决方案

```bash
# 方案 1：先 pull 再 push（推荐）
git pull origin main
git push origin main

# 方案 2：使用 rebase
git pull --rebase origin main
git push origin main

# 方案 3：强制推送（谨慎使用！）
git push --force-with-lease origin main
```

## 场景：merge 冲突解决

### 问题

```bash
$ git merge feature-branch
Auto-merging src/App.tsx
CONFLICT (content): Merge conflict in src/App.tsx
Automatic merge failed; fix conflicts and then commit the result.
```

### 经验记录

```json
{
  "id": "exp_git_002",
  "type": "error",
  "trigger": {
    "tool": "Bash",
    "action_pattern": "git merge"
  },
  "lesson": {
    "what_failed": "合并分支时产生冲突，手动解决容易出错",
    "what_worked": "使用 VS Code 或 git mergetool 可视化解决",
    "better_approach": "合并前先在本地测试，小步合并减少冲突"
  }
}
```

### 解决步骤

```bash
# 1. 查看冲突文件
git status

# 2. 使用工具解决（推荐 VS Code）
code .
# 或
git mergetool

# 3. 标记为已解决
git add src/App.tsx

# 4. 完成合并
git commit -m "merge: resolve conflicts with feature-branch"
```

## 场景：误删分支

### 问题

```bash
$ git branch -D important-feature
Deleted branch important-feature (was abc1234).
# 哦不！删错了！
```

### 经验记录

```json
{
  "id": "exp_git_003",
  "type": "pitfall",
  "trigger": {
    "tool": "Bash",
    "action_pattern": "git branch -D"
  },
  "lesson": {
    "what_failed": "使用 -D 强制删除分支，没有确认",
    "what_worked": "使用 -d 只允许已合并的分支删除",
    "better_approach": "删除前先用 git branch 确认，或推送到远程备份"
  }
}
```

### 恢复方法

```bash
# 如果知道 commit hash
git reflog
# 找到删除前的 commit
git checkout -b important-feature abc1234

# 预防措施：推送分支到远程
git push origin important-feature
```

### 生成的规则

```markdown
## Rules
1. 删除分支前先用 git branch 确认目标
2. 优先使用 git branch -d 而非 -D
3. 重要分支推送远程备份后再删除
4. 合并前先在本地测试
```
