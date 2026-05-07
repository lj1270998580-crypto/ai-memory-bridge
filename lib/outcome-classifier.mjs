#!/usr/bin/env node
/**
 * outcome-classifier.mjs — Classify tool execution outcomes
 * Automatically determines success/failure/pitfall and extractable lessons
 */

import { summarizeInput, extractError } from './experience-store.mjs';

// Common error indicators across tools
const ERROR_PATTERNS = {
  bash: [
    /error/i, /failed/i, /fatal/i, /exception/i,
    /command not found/i, /permission denied/i,
    /exit code [1-9]/i, /ENOENT/i, /ERESOLVE/i
  ],
  write: [
    /eacces/i, /permission denied/i, /readonly/i
  ],
  read: [
    /enoent/i, /file not found/i, /no such file/i
  ],
  edit: [
    /patch failed/i, /conflict/i
  ]
};

// Success indicators
const SUCCESS_PATTERNS = {
  bash: [
    /success/i, /done/i, /completed/i,
    /exit code 0/i, /✓/i, /passed/i
  ],
  write: [
    /written/i, /saved/i
  ]
};

/**
 * Classify the outcome of a tool execution
 * @param {string} toolName — tool name (Bash, Write, Read, etc.)
 * @param {any} input — tool input
 * @param {any} output — tool output/response
 * @returns {object} classification result
 */
export function classifyOutcome(toolName, input, output) {
  const tool = toolName.toLowerCase();
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  
  // 1. Check for explicit errors
  const errors = [];
  const patterns = ERROR_PATTERNS[tool] || ERROR_PATTERNS.bash;
  for (const pattern of patterns) {
    if (pattern.test(outputStr)) {
      errors.push(outputStr.match(pattern)[0]);
    }
  }
  
  // 2. Check for success indicators
  const successes = [];
  const successPatterns = SUCCESS_PATTERNS[tool] || SUCCESS_PATTERNS.bash;
  for (const pattern of successPatterns) {
    if (pattern.test(outputStr)) {
      successes.push(outputStr.match(pattern)[0]);
    }
  }
  
  // 3. Determine status
  let status = 'unknown';
  let severity = 'info';
  
  if (errors.length > 0) {
    status = 'failure';
    severity = 'error';
  } else if (successes.length > 0) {
    status = 'success';
    severity = 'info';
  } else if (outputStr.length < 100 && !outputStr.includes('error')) {
    // Likely success if short and no error
    status = 'success';
  }
  
  // 4. Detect pitfall (failure that implies a lesson)
  const isPitfall = detectPitfall(tool, inputStr, outputStr, status);
  
  // 5. Detect new pattern (unique tool+input combination)
  const isNewPattern = detectNewPattern(tool, input);
  
  // 6. Determine if worth recording
  // Record: failures, pitfalls, and successes that contain special patterns (solutions)
  const isWorthRecording = status === 'failure' || isPitfall || (status === 'success' && isNewPattern);
  
  // 7. Extract lesson hints
  const lesson = extractLessonHint(tool, inputStr, outputStr, status);
  
  return {
    status,
    severity,
    is_pitfall: isPitfall,
    is_new_pattern: isNewPattern,
    is_worth_recording: isWorthRecording,
    errors: errors.slice(0, 3),
    successes: successes.slice(0, 3),
    lesson_hint: lesson,
    output_summary: outputStr.slice(0, 500)
  };
}

function detectPitfall(tool, input, output, status) {
  // A pitfall is a non-obvious failure or partial success with hidden consequences
  
  // Common pitfall patterns
  const pitfallPatterns = [
    // npm install with peer dep issues
    { tool: 'bash', pattern: /npm install/i, output: /peer dependency|ERESOLVE/i },
    // git push without pull
    { tool: 'bash', pattern: /git push/i, output: /rejected|behind/i },
    // rm -rf dangerous paths
    { tool: 'bash', pattern: /rm -rf.*\//i, output: /./ },
    // database migration without backup
    { tool: 'bash', pattern: /migrate|migration/i, output: /error|failed/i },
    // TypeScript compilation with implicit any
    { tool: 'bash', pattern: /tsc|typescript/i, output: /implicit|any|type error/i },
    // Test command that skips tests
    { tool: 'bash', pattern: /test/i, output: /skip|pass.*0.*fail|no tests/i }
  ];
  
  for (const p of pitfallPatterns) {
    if (tool === p.tool && p.pattern.test(input) && p.output.test(output)) {
      return true;
    }
  }
  
  // Partial success with warnings
  if (status === 'success' && /warning|deprecated|outdated|vulnerable/i.test(output)) {
    return true;
  }
  
  return false;
}

function detectNewPattern(tool, input) {
  // Simple heuristic: complex or unusual input patterns
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  
  // New if contains unusual flags or combinations
  const unusualPatterns = [
    /--[a-z-]{10,}/,  // Long flag names
    /\|.*\|.*\|/,      // Complex pipes
    /awk|sed|perl/,    // Scripting tools
    /curl.*-X.*POST/   // API calls with methods
  ];
  
  for (const pattern of unusualPatterns) {
    if (pattern.test(inputStr)) {
      return true;
    }
  }
  
  return false;
}

function extractLessonHint(tool, input, output, status) {
  if (status !== 'failure' && status !== 'partial') {
    return null;
  }
  
  const errorDesc = extractError(output);
  
  // Map common errors to lesson hints
  const lessonMap = [
    {
      pattern: /ERESOLVE|peer dependency/,
      what_failed: '直接运行 npm install 未处理 peer dependency 冲突',
      what_worked: '添加 --legacy-peer-deps 标志',
      better_approach: '先检查 node 版本兼容性，再决定安装策略'
    },
    {
      pattern: /permission denied|EACCES/,
      what_failed: '当前用户权限不足',
      what_worked: '使用 sudo 或修改文件权限',
      better_approach: '避免使用 sudo 运行 npm，改用 nvm 管理 node 版本'
    },
    {
      pattern: /ENOENT|file not found|no such file/,
      what_failed: '操作的目标文件或目录不存在',
      what_worked: '先创建目录或检查路径',
      better_approach: '使用 mkdir -p 确保目录存在，或先验证路径'
    },
    {
      pattern: /port.*already in use|EADDRINUSE/,
      what_failed: '目标端口被占用',
      what_worked: '查找并终止占用进程，或更换端口',
      better_approach: '使用环境变量配置端口，避免硬编码'
    },
    {
      pattern: /git.*rejected|behind|merge conflict/,
      what_failed: '远程分支有更新，本地推送被拒绝',
      what_worked: '先 git pull 再 git push',
      better_approach: '推送前先拉取更新，或使用 git push --force-with-lease'
    }
  ];
  
  for (const lesson of lessonMap) {
    if (lesson.pattern.test(output) || lesson.pattern.test(errorDesc)) {
      return lesson;
    }
  }
  
  // Generic lesson for unmapped errors
  return {
    what_failed: `执行失败: ${errorDesc}`,
    what_worked: '查看错误日志，搜索解决方案',
    better_approach: '先理解错误原因，再针对性修复'
  };
}

/**
 * Determine storage scope based on experience content
 */
export function determineScope(experience) {
  // Auto-promote criteria: general patterns applicable across projects
  const globalIndicators = [
    'npm', 'git', 'docker', 'ssh',
    'security', 'performance', 'testing',
    'general', 'universal', 'language-agnostic'
  ];
  
  const tags = experience.metadata?.tags || [];
  const tool = experience.trigger?.tool || '';
  
  // Check if tags or tool indicate global applicability
  const isGlobal = globalIndicators.some(indicator => 
    tags.includes(indicator) || tool.toLowerCase().includes(indicator)
  );
  
  return isGlobal ? 'global' : 'project';
}
