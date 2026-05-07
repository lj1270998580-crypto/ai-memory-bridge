#!/usr/bin/env node
/**
 * test-post-tool.mjs — 测试 PostToolUse Hook 的自动学习功能
 */

import { readFileSync, readdirSync, existsSync, rmSync, statSync } from 'fs';
import { resolve } from 'path';

const testCases = [
  {
    name: "npm install ERESOLVE 失败",
    input: {
      tool_name: "Bash",
      tool_input: { command: "npm install" },
      tool_output: {
        stderr: "npm ERR! ERESOLVE could not resolve\nnpm ERR! peer dependency conflict",
        exit_code: 1
      },
      session_id: "test_session_001"
    },
    expected_type: "pitfall"
  },
  {
    name: "npm install 成功（带 --legacy-peer-deps）",
    input: {
      tool_name: "Bash",
      tool_input: { command: "npm install --legacy-peer-deps" },
      tool_output: {
        stdout: "added 42 packages in 3s",
        exit_code: 0
      },
      session_id: "test_session_001"
    },
    expected_type: "pattern"
  },
  {
    name: "git push 被拒绝",
    input: {
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
      tool_output: {
        stderr: "! [rejected] main -> main (fetch first)",
        exit_code: 1
      },
      session_id: "test_session_001"
    },
    expected_type: "pitfall"
  }
];

async function runTest() {
  console.log("🧪 Testing PostToolUse Hook\n");
  console.log("=" .repeat(60));
  
  const hookPath = resolve(process.env.USERPROFILE || process.env.HOME, '.claude/skills/ai-memory-bridge/hooks/post-tool.mjs');
  const experiencesDir = resolve('D:/.ai-memory/experiences');
  
  // 清理
  console.log("\n🧹 Cleaning previous test experiences...");
  if (existsSync(experiencesDir)) {
    const files = readdirSync(experiencesDir).filter(f => f.endsWith('.json'));
    for (const f of files) rmSync(resolve(experiencesDir, f));
    console.log(`   Cleared ${files.length} experiences`);
  }
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 Test ${i + 1}: ${testCase.name}`);
    console.log("─".repeat(60));
    
    try {
      const { spawnSync } = await import('child_process');
      
      const result = spawnSync('node', [hookPath], {
        input: JSON.stringify(testCase.input),
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, AMB_DEBUG: '1' }
      });
      
      if (result.stderr && result.stderr.includes('[AMB]')) {
        console.log(`   ${result.stderr.trim()}`);
      }
      
      // 读取所有经验并按修改时间排序
      const files = existsSync(experiencesDir) 
        ? readdirSync(experiencesDir)
            .filter(f => f.endsWith('.json'))
            .map(f => ({
              name: f,
              path: resolve(experiencesDir, f),
              mtime: statSync(resolve(experiencesDir, f)).mtimeMs
            }))
            .sort((a, b) => b.mtime - a.mtime)
        : [];
      
      console.log(`   Total experiences: ${files.length}`);
      
      if (files.length > 0) {
        // 获取最新的经验（应该是当前测试创建的）
        const latestExp = JSON.parse(readFileSync(files[0].path, 'utf8'));
        
        console.log(`   ✓ Experience: ${latestExp.id}`);
        console.log(`   Type: ${latestExp.type} (expected: ${testCase.expected_type})`);
        console.log(`   Tool: ${latestExp.trigger.tool}`);
        
        if (latestExp.lesson?.what_failed) {
          console.log(`   Lesson: ${latestExp.lesson.what_failed.slice(0, 80)}`);
        }
        if (latestExp.lesson?.better_approach) {
          console.log(`   Better: ${latestExp.lesson.better_approach.slice(0, 80)}`);
        }
        
        const typeMatch = latestExp.type === testCase.expected_type;
        if (typeMatch) {
          console.log(`   ✅ PASS`);
          passed++;
        } else {
          console.log(`   ❌ FAIL: Expected ${testCase.expected_type}, got ${latestExp.type}`);
          failed++;
        }
      } else {
        console.log(`   ⚠️  No experience created`);
        failed++;
      }
      
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      failed++;
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Test Summary");
  const finalFiles = existsSync(experiencesDir) 
    ? readdirSync(experiencesDir).filter(f => f.endsWith('.json')) 
    : [];
  console.log(`   Total experiences: ${finalFiles.length}`);
  console.log(`   Passed: ${passed}/${testCases.length}`);
  console.log(`   Failed: ${failed}/${testCases.length}`);
  
  if (finalFiles.length > 0) {
    console.log("\n   All experiences:");
    finalFiles.forEach((f, i) => {
      const exp = JSON.parse(readFileSync(resolve(experiencesDir, f), 'utf8'));
      const lesson = exp.lesson?.what_failed?.slice(0, 40) || exp.lesson?.what_worked?.slice(0, 40) || 'No lesson';
      console.log(`   ${i + 1}. [${exp.type}] ${exp.trigger.tool} - ${lesson}`);
    });
  }
  
  return failed === 0;
}

runTest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
