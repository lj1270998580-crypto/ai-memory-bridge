#!/usr/bin/env node
/**
 * test-loop-detector.mjs — 直接测试循环检测逻辑
 */

import { recordExecution, detectLoop, formatLoopAlert, resetSession } from '../lib/loop-detector.mjs';

console.log("🔄 Testing Loop Detector\n");
console.log("=" .repeat(60));

// 重置状态
resetSession();

// 模拟 3 次失败的 npm install
console.log("\n📋 Simulating 3 failed npm install calls...");
for (let i = 0; i < 3; i++) {
  recordExecution("Bash", { command: "npm install" }, { 
    stderr: "npm ERR! ERESOLVE could not resolve", 
    exit_code: 1 
  }, { 
    status: "failure", 
    errors: ["ERESOLVE could not resolve"] 
  });
  console.log(`   Call ${i + 1} recorded`);
}

// 检测循环
const loopStatus = detectLoop();
console.log(`\n   Loop detected: ${loopStatus.is_looping}`);
console.log(`   Loop type: ${loopStatus.loop_type}`);

if (loopStatus.is_looping) {
  console.log("\n✅ PASS: Loop correctly detected!");
  console.log("\n🛑 Block message preview:");
  console.log(formatLoopAlert(loopStatus).slice(0, 300) + "...");
} else {
  console.log("\n❌ FAIL: Loop not detected");
  console.log("   Details:", JSON.stringify(loopStatus, null, 2));
}

// 测试序列循环
console.log("\n" + "=".repeat(60));
console.log("\n📋 Testing sequence loop detection...");
resetSession();

// 模拟序列循环: A→B→C→A→B→C
const sequence = ["Read", "Grep", "Edit", "Read", "Grep", "Edit"];
for (const tool of sequence) {
  recordExecution(tool, { file: "test.ts" }, { content: "..." }, { status: "success" });
}

const seqLoop = detectLoop();
console.log(`   Loop detected: ${seqLoop.is_looping}`);
console.log(`   Loop type: ${seqLoop.loop_type || 'none'}`);

if (seqLoop.is_looping && seqLoop.loop_type === 'sequence_loop') {
  console.log("\n✅ PASS: Sequence loop detected!");
} else {
  console.log("\n❌ Sequence loop not detected (may need more repetitions)");
}

// 测试无循环场景
console.log("\n" + "=".repeat(60));
console.log("\n📋 Testing normal operations (no loop)...");
resetSession();

recordExecution("Read", { file: "main.ts" }, { content: "..." }, { status: "success" });
recordExecution("Bash", { command: "ls" }, { stdout: "file1.ts file2.ts" }, { status: "success" });
recordExecution("Write", { file: "new.ts", content: "..." }, { success: true }, { status: "success" });

const noLoop = detectLoop();
console.log(`   Loop detected: ${noLoop.is_looping}`);

if (!noLoop.is_looping) {
  console.log("\n✅ PASS: No false positive!");
} else {
  console.log("\n❌ FAIL: False positive detected");
}

console.log("\n" + "=".repeat(60));
console.log("\n✅ Loop detector tests completed");
