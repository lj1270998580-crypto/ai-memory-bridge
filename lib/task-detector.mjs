#!/usr/bin/env node
/**
 * task-detector.mjs — Detect task completion and boundaries
 * Automatically identifies when a meaningful task has been completed
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Task state tracking
let taskState = {
  startTime: null,
  toolCalls: [],
  successStreak: 0,
  lastUserMessage: '',
  isActive: false
};

// Task completion indicators in user messages
const TASK_COMPLETION_KEYWORDS = [
  /(?:^|[^\w])(?:done|finished|completed|完成|好了|搞定)(?:[^\w]|$)/i,
  /(?:^|[^\w])(?:thanks|thank you|谢谢|感谢)(?:[^\w]|$)/i,
  /(?:^|[^\w])(?:perfect|great|awesome|太棒了|不错)(?:[^\w]|$)/i,
  /(?:^|[^\w])(?:let's move on|next|下一个|继续)(?:[^\w]|$)/i
];

// Task boundary tools (actions that typically complete a task)
const TASK_BOUNDARY_TOOLS = {
  Bash: [
    /git\s+commit/,
    /git\s+push/,
    /npm\s+publish/,
    /deploy/,
    /test.*--watch.*false/,
    /test.*ci/,
    /build.*production/
  ],
  Write: [
    /README/,
    /CHANGELOG/,
    /\.md$/
  ],
  Edit: [
    /config\.json/,
    /package\.json/
  ]
};

/**
 * Record a tool execution and check if task is complete
 * @param {string} toolName
 * @param {any} input
 * @param {any} output
 * @param {string} outcomeStatus
 * @returns {object|null} Task completion info if task is complete, null otherwise
 */
export function recordToolExecution(toolName, input, output, outcomeStatus) {
  const now = Date.now();
  
  // Initialize task if not active
  if (!taskState.isActive) {
    const preservedMessage = taskState.lastUserMessage;
    taskState = {
      startTime: now,
      toolCalls: [],
      successStreak: 0,
      lastUserMessage: preservedMessage,
      isActive: true
    };
  }
  
  // Record the tool call
  taskState.toolCalls.push({
    tool: toolName,
    time: now,
    status: outcomeStatus
  });
  
  // Update success streak
  if (outcomeStatus === 'success') {
    taskState.successStreak++;
  } else {
    taskState.successStreak = 0;
  }
  
  // Check for task completion
  const completion = checkTaskCompletion(toolName, input, output, outcomeStatus);
  
  if (completion) {
    // Reset task state
    const taskSummary = generateTaskSummary();
    taskState = {
      startTime: null,
      toolCalls: [],
      successStreak: 0,
      lastUserMessage: '',
      isActive: false
    };
    
    return {
      ...completion,
      summary: taskSummary
    };
  }
  
  return null;
}

/**
 * Check if current tool execution completes a task
 */
function checkTaskCompletion(toolName, input, output, outcomeStatus) {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  
  // 1. Check for task completion in user message (highest priority - explicit signal)
  if (taskState.lastUserMessage) {
    for (const pattern of TASK_COMPLETION_KEYWORDS) {
      if (pattern.test(taskState.lastUserMessage)) {
        return {
          type: 'user_signal',
          reason: 'User indicated completion',
          confidence: 0.9
        };
      }
    }
  }
  
  // 2. Check for boundary tools with success
  if (outcomeStatus === 'success') {
    const patterns = TASK_BOUNDARY_TOOLS[toolName] || [];
    for (const pattern of patterns) {
      if (pattern.test(inputStr) || pattern.test(outputStr)) {
        return {
          type: 'boundary_tool',
          reason: `${toolName} with ${pattern}`,
          confidence: 0.85
        };
      }
    }
  }
  
  // 3. Check for success streak (5+ consecutive successes without errors)
  if (taskState.successStreak >= 5 && taskState.toolCalls.length >= 5) {
    // Make sure there are meaningful operations (not just reads)
    const meaningfulOps = taskState.toolCalls.filter(
      call => call.tool === 'Bash' || call.tool === 'Write' || call.tool === 'Edit'
    );
    if (meaningfulOps.length >= 3) {
      return {
        type: 'success_streak',
        reason: `${taskState.successStreak} consecutive successes`,
        confidence: 0.7
      };
    }
  }
  
  // 4. Long session with many operations -> likely complete
  const sessionDuration = Date.now() - taskState.startTime;
  const toolCount = taskState.toolCalls.length;
  if (sessionDuration > 600000 && toolCount > 20) { // 10+ minutes, 20+ tools
    const successRate = taskState.toolCalls.filter(c => c.status === 'success').length / toolCount;
    if (successRate > 0.8) {
      return {
        type: 'session_timeout',
        reason: `Long session (${Math.round(sessionDuration / 60000)}min, ${toolCount} tools)`,
        confidence: 0.6
      };
    }
  }
  
  return null;
}

/**
 * Update last user message for keyword detection
 */
export function updateUserMessage(message) {
  if (message) {
    taskState.lastUserMessage = message;
  }
}

/**
 * Generate a summary of the completed task
 */
function generateTaskSummary() {
  const tools = {};
  const outcomes = { success: 0, failure: 0, unknown: 0 };
  
  for (const call of taskState.toolCalls) {
    tools[call.tool] = (tools[call.tool] || 0) + 1;
    outcomes[call.status] = (outcomes[call.status] || 0) + 1;
  }
  
  const duration = Date.now() - taskState.startTime;
  
  return {
    duration_ms: duration,
    tool_count: taskState.toolCalls.length,
    tools_used: tools,
    outcomes: outcomes,
    success_rate: outcomes.success / taskState.toolCalls.length
  };
}

/**
 * Get current task state (for debugging)
 */
export function getTaskState() {
  return { ...taskState };
}

/**
 * Force end current task (e.g., on session end)
 */
export function forceEndTask() {
  if (taskState.isActive && taskState.toolCalls.length > 0) {
    const summary = generateTaskSummary();
    taskState = {
      startTime: null,
      toolCalls: [],
      successStreak: 0,
      lastUserMessage: '',
      isActive: false
    };
    return {
      type: 'forced_end',
      reason: 'Session ended or manual trigger',
      confidence: 0.5,
      summary
    };
  }
  return null;
}

/**
 * Check if auto-save should trigger after task completion
 * @returns {boolean}
 */
export function shouldAutoSave() {
  if (!taskState.isActive) return false;
  
  // Auto-save on:
  // 1. Strong completion signals (boundary tool + success)
  // 2. User explicitly said done
  const lastCalls = taskState.toolCalls.slice(-3);
  const hasBoundaryTool = lastCalls.some(call => {
    const patterns = TASK_BOUNDARY_TOOLS[call.tool] || [];
    return patterns.length > 0 && call.status === 'success';
  });
  
  const hasUserCompletion = TASK_COMPLETION_KEYWORDS.some(
    pattern => pattern.test(taskState.lastUserMessage)
  );
  
  return hasBoundaryTool || hasUserCompletion;
}
