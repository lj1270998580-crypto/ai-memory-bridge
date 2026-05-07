#!/usr/bin/env node
/**
 * loop.mjs — Check loop detection status
 */

import { detectLoop, getSessionStats, formatLoopAlert, generateRecoverySuggestions } from '../lib/loop-detector.mjs';

function main() {
  console.log('🔄 AI Memory Bridge: Loop Detection Status\n');
  
  const stats = getSessionStats();
  
  console.log('Session Statistics:');
  console.log(`  Total Calls: ${stats.total_calls}`);
  console.log(`  Unique Tools: ${stats.unique_tools}`);
  console.log(`  Failure Rate: ${(stats.failure_rate * 100).toFixed(1)}%`);
  console.log(`  Loops Blocked: ${stats.blocked_loops}`);
  console.log('');
  
  // Check current status
  const loopStatus = detectLoop();
  
  if (loopStatus.is_looping) {
    console.log('⚠️  CURRENTLY IN LOOP\n');
    console.log(formatLoopAlert(loopStatus));
    console.log('');
    
    const suggestions = generateRecoverySuggestions(loopStatus);
    console.log('Recovery Options:');
    for (const sug of suggestions) {
      console.log(`  ${sug.key}. ${sug.label}`);
      console.log(`     ${sug.action}`);
    }
  } else {
    console.log('✅ No loop detected currently');
    console.log('');
    console.log('Loop Detection Thresholds:');
    console.log('  Exact Repeat: 3 identical calls');
    console.log('  Error Loop: 3 identical errors');
    console.log('  Sequence Loop: 2 repeating sequences');
    console.log('  Token Burn: 5 calls with high failure rate');
  }
  
  console.log('');
  console.log('💡 If you suspect a loop, check recent tool calls.');
  console.log('   The next PreToolUse hook will automatically detect and block it.');
}

main();
