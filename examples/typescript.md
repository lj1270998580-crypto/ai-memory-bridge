# 示例：TypeScript 踩坑记录

## 场景：strict 模式导致构建失败

### 问题

```typescript
// src/utils.ts
function processData(data: any) {
  return data.name.toUpperCase();
}
```

```bash
$ npm run build
error TS2345: Argument of type 'any' is not assignable to parameter of type 'never'.
```

### 原因

tsconfig.json 开启了 strict 模式，但代码中存在隐式 any。

### 经验记录

```json
{
  "id": "exp_ts_001",
  "type": "error",
  "trigger": {
    "tool": "Bash",
    "action_pattern": "npm run build"
  },
  "lesson": {
    "what_failed": "TypeScript 严格模式导致构建失败",
    "what_worked": "添加类型注解或调整 tsconfig 配置",
    "better_approach": "检查 tsconfig.json 的 strict 选项，逐步启用严格模式"
  }
}
```

### 解决方案

```typescript
// 方案 1：添加类型注解
interface Data {
  name: string;
}

function processData(data: Data) {
  return data.name.toUpperCase();
}

// 方案 2：类型守卫
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'name' in data) {
    return (data as { name: string }).name.toUpperCase();
  }
  throw new Error('Invalid data');
}

// 方案 3：调整 tsconfig（不推荐）
// tsconfig.json
{
  "compilerOptions": {
    "strict": false  // 关闭严格模式
  }
}
```

## 场景：忘记导出类型

### 问题

```typescript
// src/types.ts
interface User {
  id: number;
  name: string;
}

// src/components/UserCard.tsx
import { User } from '../types';  // ❌ 错误！User 未导出
```

### 经验记录

```json
{
  "id": "exp_ts_002",
  "type": "error",
  "trigger": {
    "tool": "Write",
    "action_pattern": "UserCard.tsx"
  },
  "lesson": {
    "what_failed": "忘记导出 interface/type",
    "better_approach": "定义类型时立即导出，或使用 export * from './types'"
  }
}
```

### 最佳实践

```typescript
// src/types.ts
// 定义时立即导出
export interface User {
  id: number;
  name: string;
}

export type UserRole = 'admin' | 'user' | 'guest';

// 或使用命名空间
export namespace Types {
  export interface User {
    id: number;
    name: string;
  }
}
```

## 场景：any 类型滥用

### 问题

```typescript
// 不好的实践
const user: any = fetchUser();
user.nmae.toUpperCase();  // 运行时错误，编译时不报错
```

### 经验记录

```json
{
  "id": "exp_ts_003",
  "type": "pitfall",
  "trigger": {
    "tool": "Write",
    "action_pattern": "*.ts"
  },
  "lesson": {
    "what_failed": "使用 any 类型导致运行时错误",
    "better_approach": "使用 unknown 替代 any，配合类型守卫使用"
  }
}
```

### 改进方案

```typescript
// 好的实践
const user: unknown = fetchUser();

if (isUser(user)) {
  console.log(user.name.toUpperCase());  // ✅ 类型安全
}

// 类型守卫函数
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj
  );
}
```

## 场景：循环依赖

### 问题

```typescript
// src/A.ts
import { B } from './B';
export class A {
  b = new B();
}

// src/B.ts
import { A } from './A';  // ❌ 循环依赖！
export class B {
  a = new A();
}
```

### 经验记录

```json
{
  "id": "exp_ts_004",
  "type": "error",
  "lesson": {
    "what_failed": "模块间循环依赖导致构建失败或运行时错误",
    "better_approach": "使用接口抽象、依赖注入或重新设计模块结构"
  }
}
```

### 解决方案

```typescript
// 方案 1：使用接口
// src/interfaces.ts
export interface IA {
  doSomething(): void;
}

export interface IB {
  doSomethingElse(): void;
}

// src/A.ts
import { IB } from './interfaces';
export class A {
  constructor(private b: IB) {}
}

// src/B.ts
import { IA } from './interfaces';
export class B {
  constructor(private a: IA) {}
}

// 方案 2：依赖注入
// src/container.ts
import { A } from './A';
import { B } from './B';

const b = new B();
const a = new A(b);
// 注意初始化顺序
```

### 生成的规则

```markdown
## Rules
1. 定义类型时立即使用 export
2. 使用 unknown 替代 any，配合类型守卫
3. 避免模块间循环依赖，使用接口抽象
4. 检查 tsconfig.json 的 strict 配置
5. 启用 noImplicitAny 和 strictNullChecks
```
