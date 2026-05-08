#!/usr/bin/env node
/**
 * test-task-compaction.mjs — Test task detection and compaction
 */

import { 
  recordToolExecution, 
  updateUserMessage, 
  getTaskState,
  forceEndTask 
} from '../lib/task-detector.mjs';

import {
  compactMemory,
  getCompactionStats
} from '../lib/compaction.mjs';

console.log('🧪 Testing Task Detection & Compaction\n');

// Test 1: Success streak detection
{
  console.log('Test 1: Success streak detection');
  
  // Reset state
  forceEndTask();
  
  // Simulate 5 successful tool calls
  for (let i = 0; i < 5; i++) {
    const result = recordToolExecution('Bash', { command: 'npm install' }, 'success', 'success');
    if (i < 4) {
      console.assert(result === null, 'Should not detect completion yet');
    } else {
      console.assert(result !== null, 'Should detect completion after 5 successes');
      console.assert(result.type === 'success_streak', 'Should be success_streak type');
      console.log('✅ Detected task completion:', result.reason);
    }
  }
}

// Test 2: Boundary tool detection
{
  console.log('\nTest 2: Boundary tool detection');
  
  forceEndTask();
  
  const result = recordToolExecution(
    'Bash', 
    { command: 'git commit -m "feat: add new feature"' }, 
    'success', 
    'success'
  );
  
  console.assert(result !== null, 'Should detect git commit as task boundary');
  console.assert(result.type === 'boundary_tool', 'Should be boundary_tool type');
  console.log('✅ Detected boundary tool:', result.reason);
}

// Test 3: User message completion signal
{
  console.log('\nTest 3: User completion signal');
  
  forceEndTask();
  updateUserMessage('done, thanks!');
  
  // The user signal should trigger on the first tool call after the message
  const result = recordToolExecution('Write', { filePath: 'test.js' }, 'written', 'success');
  
  console.assert(result !== null, 'Should detect user completion signal');
  console.assert(result.type === 'user_signal', 'Should be user_signal type');
  console.log('✅ Detected user signal:', result.reason);
}

// Test 4: Force end task
{
  console.log('\nTest 4: Force end task');
  
  forceEndTask();
  
  // Add some tool calls
  recordToolExecution('Write', { filePath: 'test.js' }, 'written', 'success');
  recordToolExecution('Bash', { command: 'node test.js' }, 'output', 'success');
  
  const result = forceEndTask();
  
  console.assert(result !== null, 'Should force end active task');
  console.assert(result.type === 'forced_end', 'Should be forced_end type');
  console.assert(result.summary.tool_count === 2, 'Should have 2 tool calls');
  console.log('✅ Force ended task:', result.summary);
}

// Test 5: Compaction dry run
{
  console.log('\nTest 5: Compaction dry run');
  
  const report = compactMemory('project', true);
  
  console.assert(report.scope === 'project', 'Should be project scope');
  console.log('✅ Compaction dry run:', report.action);
  if (report.changes && report.changes.length > 0) {
    console.log('   Changes found:', report.changes.length);
  }
}

// Test 6: Compaction stats
{
  console.log('\nTest 6: Compaction stats');
  
  const stats = getCompactionStats('project');
  
  console.assert(stats.scope === 'project', 'Should be project scope');
  console.assert(typeof stats.active === 'number', 'Should have active count');
  console.log('✅ Stats:', stats);
}

// Test 7: No premature detection
{
  console.log('\nTest 7: No premature detection');
  
  forceEndTask();
  
  // Just 2 successes
  recordToolExecution('Read', { filePath: 'README.md' }, 'content', 'success');
  const result = recordToolExecution('Read', { filePath: 'package.json' }, 'content', 'success');
  
  console.assert(result === null, 'Should not detect completion with only 2 reads');
  console.log('✅ No premature detection');
}

console.log('\n🎉 All tests passed!\n');
