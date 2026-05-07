#!/usr/bin/env node
/**
 * test-all.mjs — Complete integration test for all AI Memory Bridge features
 */

import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { existsSync, readdirSync, readFileSync, rmSync } from 'fs';

const home = process.env.USERPROFILE || process.env.HOME;
const postHook = resolve(home, '.claude/skills/ai-memory-bridge/hooks/post-tool.mjs');
const rulesCmd = resolve(home, '.claude/skills/ai-memory-bridge/commands/rules.mjs');
const dashboardCmd = resolve(home, '.claude/skills/ai-memory-bridge/commands/dashboard.mjs');

const globalDir = resolve(home, '.claude/ai-memory/projects/proj_69c4b1420855/experiences');
const rulesDir = resolve('D:/.ai-memory/rules');
const dashboardFile = resolve('D:/opencode项目/ai-memory-dashboard.html');

function clean() {
  // Clean global experiences
  if (existsSync(globalDir)) {
    for (const f of readdirSync(globalDir)) {
      if (f.endsWith('.json')) rmSync(resolve(globalDir, f));
    }
  }
  // Clean rules
  if (existsSync(rulesDir)) {
    for (const f of readdirSync(rulesDir)) {
      rmSync(resolve(rulesDir, f));
    }
  }
  // Clean dashboard
  if (existsSync(dashboardFile)) {
    rmSync(dashboardFile);
  }
}

function runPostTool(data) {
  return spawnSync('node', [postHook], {
    input: JSON.stringify(data),
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, AMB_DEBUG: '1' }
  });
}

function countFiles(dir, ext) {
  return existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(ext)).length : 0;
}

console.log('🧪 AI Memory Bridge 完整集成测试\n');
console.log('=' .repeat(70));

let passed = 0;
let failed = 0;

// Clean start
clean();

// Test 1: Auto-learning with deduplication
console.log('\n📋 Test 1: Auto-learning & Deduplication');
console.log('─'.repeat(70));

for (let i = 0; i < 3; i++) {
  runPostTool({
    tool_name: "Bash",
    tool_input: { command: "npm install" },
    tool_output: { stderr: "npm ERR! ERESOLVE could not resolve", exit_code: 1 },
    session_id: "test"
  });
}

const expCount1 = countFiles(globalDir, '.json');
console.log(`   After 3 identical failures: ${expCount1} experience(s)`);

if (expCount1 === 1) {
  const exp = JSON.parse(readFileSync(readdirSync(globalDir).map(f => resolve(globalDir, f))[0], 'utf8'));
  console.log(`   Frequency: ${exp.frequency}, Confidence: ${(exp.confidence * 100).toFixed(0)}%`);
  if (exp.frequency === 3 && exp.confidence > 0.6) {
    console.log('   ✅ PASS');
    passed++;
  } else {
    console.log('   ❌ FAIL: Wrong frequency or confidence');
    failed++;
  }
} else {
  console.log('   ❌ FAIL: Should have 1 experience (merged)');
  failed++;
}

// Test 2: Different error creates new experience
console.log('\n📋 Test 2: Different Error → New Experience');
console.log('─'.repeat(70));

runPostTool({
  tool_name: "Bash",
  tool_input: { command: "git push origin main" },
  tool_output: { stderr: "! [rejected] main -> main", exit_code: 1 },
  session_id: "test"
});

const expCount2 = countFiles(globalDir, '.json');
console.log(`   After git push failure: ${expCount2} experience(s)`);

if (expCount2 === 2) {
  console.log('   ✅ PASS');
  passed++;
} else {
  console.log('   ❌ FAIL: Should have 2 experiences');
  failed++;
}

// Test 3: Rule generation
console.log('\n📋 Test 3: Rule Generation');
console.log('─'.repeat(70));

const rulesResult = spawnSync('node', [rulesCmd], {
  encoding: 'utf8',
  timeout: 10000
});

console.log(rulesResult.stdout);

const ruleFiles = countFiles(rulesDir, '.md');
console.log(`   Generated ${ruleFiles} rule file(s)`);

if (ruleFiles >= 1) {
  const readmePath = resolve(rulesDir, 'README.md');
  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, 'utf8');
    console.log('   README.md: ✅');
    if (readme.includes('AI Memory Bridge') && readme.includes('pitfall-avoidance')) {
      console.log('   ✅ PASS');
      passed++;
    } else {
      console.log('   ❌ FAIL: README content incorrect');
      failed++;
    }
  } else {
    console.log('   ❌ FAIL: README.md missing');
    failed++;
  }
} else {
  console.log('   ❌ FAIL: No rules generated');
  failed++;
}

// Test 4: Dashboard generation
console.log('\n📋 Test 4: Dashboard Generation');
console.log('─'.repeat(70));

const dashResult = spawnSync('node', [dashboardCmd], {
  encoding: 'utf8',
  timeout: 10000
});

console.log(dashResult.stdout);

if (existsSync(dashboardFile)) {
  const html = readFileSync(dashboardFile, 'utf8');
  const hasTitle = html.includes('AI Memory Bridge Dashboard');
  const hasTable = html.includes('<table>');
  const hasSearch = html.includes('searchBox');
  
  console.log(`   HTML file: ${html.length} bytes`);
  console.log(`   Title: ${hasTitle ? '✅' : '❌'}`);
  console.log(`   Table: ${hasTable ? '✅' : '❌'}`);
  console.log(`   Search: ${hasSearch ? '✅' : '❌'}`);
  
  if (hasTitle && hasTable && hasSearch) {
    console.log('   ✅ PASS');
    passed++;
  } else {
    console.log('   ❌ FAIL: Missing components');
    failed++;
  }
} else {
  console.log('   ❌ FAIL: Dashboard file not created');
  failed++;
}

// Test 5: Loop detection
console.log('\n📋 Test 5: Loop Detection');
console.log('─'.repeat(70));

const { resetSession, detectLoop, recordExecution } = await import('../lib/loop-detector.mjs');
resetSession();

for (let i = 0; i < 3; i++) {
  recordExecution("Bash", { command: "npm install" }, { error: "ERESOLVE" }, { status: "failure" });
}

const loop = detectLoop();
console.log(`   Loop detected: ${loop.is_looping}`);
console.log(`   Loop type: ${loop.loop_type || 'none'}`);

if (loop.is_looping && loop.loop_type === 'exact_repeat') {
  console.log('   ✅ PASS');
  passed++;
} else {
  console.log('   ❌ FAIL');
  failed++;
}

// Summary
console.log('\n' + '='.repeat(70));
console.log('\n📊 最终统计');
console.log(`   测试通过: ${passed}/5`);
console.log(`   测试失败: ${failed}/5`);

if (failed === 0) {
  console.log('\n🎉 所有测试通过！');
} else {
  console.log(`\n⚠️  ${failed} 项测试失败`);
}

process.exit(failed > 0 ? 1 : 0);
