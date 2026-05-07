#!/usr/bin/env node
/**
 * loop-detector.mjs — Detect execution loops and agent stalls
 * Maintains in-memory session history for real-time detection
 */

import { createHash } from 'crypto';

// Session state (in-memory only, per-process)
const sessionState = {
  history: [],
  toolCounts: new Map(),
  errorCounts: new Map(),
  sequenceWindow: [],
  tokenEstimates: [],
  blockedLoops: 0
};

const CONFIG = {
  exact_repeat_threshold: 3,
  error_loop_threshold: 3,
  sequence_loop_threshold: 2,
  token_burn_window: 5,
  max_history: 50
};

function hashToolCall(tool, input) {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  return createHash('md5').update(`${tool}:${inputStr}`).digest('hex').slice(0, 16);
}

function hashError(tool, error) {
  const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
  // Normalize error by removing variable parts (paths, timestamps, etc.)
  const normalized = errorStr
    .replace(/[\w\-]+\.[a-zA-Z]{2,4}/g, '\u003cfile\u003e')
    .replace(/\d{4}-\d{2}-\d{2}/g, '\u003cdate\u003e')
    .replace(/\d{2}:\d{2}:\d{2}/g, '\u003ctime\u003e')
    .replace(/0x[0-9a-f]+/gi, '\u003chex\u003e');
  return createHash('md5').update(`${tool}:${normalized}`).digest('hex').slice(0, 16);
}

/**
 * Record a tool execution in session history
 */
export function recordExecution(tool, input, output, outcome) {
  const entry = {
    timestamp: Date.now(),
    tool,
    input_hash: hashToolCall(tool, input),
    input_summary: typeof input === 'string' ? input.slice(0, 100) : JSON.stringify(input).slice(0, 100),
    output_summary: typeof output === 'string' ? output.slice(0, 100) : JSON.stringify(output).slice(0, 100),
    outcome: outcome?.status || 'unknown',
    error_hash: outcome?.status === 'failure' ? hashError(tool, outcome?.errors?.[0] || output) : null,
    token_estimate: estimateTokens(input, output)
  };
  
  sessionState.history.push(entry);
  
  // Keep history bounded
  if (sessionState.history.length > CONFIG.max_history) {
    sessionState.history.shift();
  }
  
  // Update counters
  updateCounters(entry);
  
  // Update sequence window
  sessionState.sequenceWindow.push(tool);
  if (sessionState.sequenceWindow.length > 10) {
    sessionState.sequenceWindow.shift();
  }
  
  // Update token estimates
  sessionState.tokenEstimates.push(entry.token_estimate);
  if (sessionState.tokenEstimates.length > CONFIG.token_burn_window) {
    sessionState.tokenEstimates.shift();
  }
}

function updateCounters(entry) {
  // Exact repeat counter
  const exactKey = `${entry.tool}:${entry.input_hash}`;
  sessionState.toolCounts.set(exactKey, (sessionState.toolCounts.get(exactKey) || 0) + 1);
  
  // Error counter
  if (entry.error_hash) {
    const errorKey = `${entry.tool}:${entry.error_hash}`;
    sessionState.errorCounts.set(errorKey, (sessionState.errorCounts.get(errorKey) || 0) + 1);
  }
}

function estimateTokens(input, output) {
  // Rough estimate: 1 token ≈ 4 characters
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  return Math.ceil((inputStr.length + outputStr.length) / 4);
}

/**
 * Detect if agent is in a loop
 * @returns {object} loop detection result
 */
export function detectLoop() {
  const history = sessionState.history;
  if (history.length < 3) {
    return { is_looping: false, details: null };
  }
  
  // Check 1: Exact repeat loop
  const exactLoop = checkExactRepeat();
  if (exactLoop) {
    return {
      is_looping: true,
      loop_type: 'exact_repeat',
      confidence: 0.95,
      details: exactLoop,
      affected_experiences: findRelatedExperiences(exactLoop.tool)
    };
  }
  
  // Check 2: Error loop
  const errorLoop = checkErrorLoop();
  if (errorLoop) {
    return {
      is_looping: true,
      loop_type: 'error_loop',
      confidence: 0.9,
      details: errorLoop,
      affected_experiences: findRelatedExperiences(errorLoop.tool)
    };
  }
  
  // Check 3: Sequence loop
  const sequenceLoop = checkSequenceLoop();
  if (sequenceLoop) {
    return {
      is_looping: true,
      loop_type: 'sequence_loop',
      confidence: 0.85,
      details: sequenceLoop,
      affected_experiences: findRelatedExperiences(sequenceLoop.tools[0])
    };
  }
  
  // Check 4: Token burn
  const tokenBurn = checkTokenBurn();
  if (tokenBurn) {
    return {
      is_looping: true,
      loop_type: 'token_burn',
      confidence: 0.8,
      details: tokenBurn,
      affected_experiences: []
    };
  }
  
  return { is_looping: false, details: null };
}

function checkExactRepeat() {
  for (const [key, count] of sessionState.toolCounts.entries()) {
    if (count >= CONFIG.exact_repeat_threshold) {
      const [tool] = key.split(':');
      const matchingEntries = sessionState.history.filter(e => 
        `${e.tool}:${e.input_hash}` === key
      );
      return {
        tool,
        count,
        threshold: CONFIG.exact_repeat_threshold,
        last_attempt: matchingEntries[matchingEntries.length - 1]
      };
    }
  }
  return null;
}

function checkErrorLoop() {
  for (const [key, count] of sessionState.errorCounts.entries()) {
    if (count >= CONFIG.error_loop_threshold) {
      const [tool] = key.split(':');
      const matchingEntries = sessionState.history.filter(e => 
        e.error_hash && `${e.tool}:${e.error_hash}` === key
      );
      return {
        tool,
        error_type: key.split(':')[1],
        count,
        threshold: CONFIG.error_loop_threshold,
        last_error: matchingEntries[matchingEntries.length - 1]
      };
    }
  }
  return null;
}

function checkSequenceLoop() {
  const seq = sessionState.sequenceWindow;
  if (seq.length < 6) return null;
  
  // Look for repeating sequences of length 3-5
  for (let seqLen = 3; seqLen <= 5; seqLen++) {
    if (seq.length < seqLen * 2) continue;
    
    const recent = seq.slice(-seqLen * 2);
    const first = recent.slice(0, seqLen).join(',');
    const second = recent.slice(seqLen).join(',');
    
    if (first === second) {
      return {
        tools: seq.slice(-seqLen),
        sequence: first.split(','),
        repetitions: 2,
        threshold: CONFIG.sequence_loop_threshold
      };
    }
  }
  
  return null;
}

function checkTokenBurn() {
  const estimates = sessionState.tokenEstimates;
  if (estimates.length < CONFIG.token_burn_window) return null;
  
  // Check if recent calls consume tokens but produce no value
  const recent = estimates.slice(-CONFIG.token_burn_window);
  const avgTokens = recent.reduce((a, b) => a + b, 0) / recent.length;
  
  // Check corresponding outcomes
  const recentOutcomes = sessionState.history.slice(-CONFIG.token_burn_window);
  const failureRate = recentOutcomes.filter(e => e.outcome === 'failure').length / recentOutcomes.length;
  
  // High token usage + high failure rate = token burn
  if (avgTokens > 500 && failureRate > 0.6) {
    return {
      avg_tokens: Math.round(avgTokens),
      failure_rate: Math.round(failureRate * 100),
      window_size: CONFIG.token_burn_window,
      recent_calls: recentOutcomes.map(e => ({
        tool: e.tool,
        outcome: e.outcome,
        tokens: e.token_estimate
      }))
    };
  }
  
  return null;
}

function findRelatedExperiences(tool) {
  // This would query the experience store
  // For now, return placeholder based on tool name
  return [];
}

/**
 * Get session statistics
 */
export function getSessionStats() {
  return {
    total_calls: sessionState.history.length,
    blocked_loops: sessionState.blockedLoops,
    unique_tools: new Set(sessionState.history.map(e => e.tool)).size,
    failure_rate: sessionState.history.length > 0
      ? sessionState.history.filter(e => e.outcome === 'failure').length / sessionState.history.length
      : 0
  };
}

/**
 * Mark a loop as blocked
 */
export function markLoopBlocked() {
  sessionState.blockedLoops++;
}

/**
 * Reset session state (for testing)
 */
export function resetSession() {
  sessionState.history = [];
  sessionState.toolCounts.clear();
  sessionState.errorCounts.clear();
  sessionState.sequenceWindow = [];
  sessionState.tokenEstimates = [];
  sessionState.blockedLoops = 0;
}

/**
 * Format loop alert for user display
 */
export function formatLoopAlert(loopStatus) {
  const { loop_type, details } = loopStatus;
  
  let alert = `🛑 AI Memory Bridge: 检测到执行循环\n\n`;
  alert += `循环类型：${translateLoopType(loop_type)}\n`;
  
  switch (loop_type) {
    case 'exact_repeat':
      alert += `工具：${details.tool}\n`;
      alert += `重复次数：${details.count} 次（阈值：${details.threshold}）\n`;
      alert += `最后尝试：${details.last_attempt.input_summary}\n`;
      break;
    case 'error_loop':
      alert += `工具：${details.tool}\n`;
      alert += `错误类型：${details.error_type}\n`;
      alert += `失败次数：${details.count} 次（阈值：${details.threshold}）\n`;
      break;
    case 'sequence_loop':
      alert += `循环序列：${details.sequence.join(' → ')}\n`;
      alert += `重复轮数：${details.repetitions} 轮\n`;
      break;
    case 'token_burn':
      alert += `平均消耗：${details.avg_tokens} tokens/次\n`;
      alert += `失败率：${details.failure_rate}%\n`;
      alert += `检测窗口：最近 ${details.window_size} 次调用\n`;
      break;
  }
  
  return alert;
}

function translateLoopType(type) {
  const map = {
    exact_repeat: '精确重复',
    error_loop: '错误循环',
    sequence_loop: '序列循环',
    token_burn: 'Token 空转'
  };
  return map[type] || type;
}

/**
 * Generate recovery suggestions
 */
export function generateRecoverySuggestions(loopStatus) {
  const suggestions = [];
  
  suggestions.push({
    key: 'A',
    label: '[推荐] 分析原因并换方案',
    action: '停下来分析根本原因，尝试完全不同的解决路径'
  });
  
  suggestions.push({
    key: 'B',
    label: '缩小范围，单点突破',
    action: '将问题拆分为更小的部分，逐一验证'
  });
  
  suggestions.push({
    key: 'C',
    label: '查看历史经验',
    action: '搜索是否有过类似问题的记录和解决方案'
  });
  
  if (loopStatus.affected_experiences?.length > 0) {
    suggestions.push({
      key: 'D',
      label: '应用已知解决方案',
      action: '基于历史经验尝试已验证的方案'
    });
  }
  
  suggestions.push({
    key: 'E',
    label: '人工接管',
    action: '暂停AI，由用户直接指导下一步'
  });
  
  return suggestions;
}
