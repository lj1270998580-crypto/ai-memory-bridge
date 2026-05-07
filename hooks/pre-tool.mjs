#!/usr/bin/env node
/**
 * pre-tool.mjs — PreToolUse Hook
 * Injects relevant experiences and detects loops before execution
 */

import { readFileSync } from 'fs';
import { detectProject } from '../lib/detect-project.mjs';
import { findExperiences } from '../lib/experience-store.mjs';
import { detectLoop, markLoopBlocked, formatLoopAlert, generateRecoverySuggestions } from '../lib/loop-detector.mjs';
import { buildAdviceContext, predictConsequences, buildLoopBlockMessage } from '../lib/context-builder.mjs';

async function main() {
  try {
    // Read hook data from stdin
    const stdin = readFileSync(0, 'utf8');
    if (!stdin.trim()) {
      process.exit(0);
    }
    
    const data = JSON.parse(stdin);
    const { tool_name, tool_input } = data;
    
    if (!tool_name) {
      process.exit(0);
    }
    
    const inputStr = typeof tool_input === 'string' ? tool_input : JSON.stringify(tool_input);
    
    // 1. Loop Detection (Highest Priority)
    const loopStatus = detectLoop();
    
    if (loopStatus.is_looping) {
      // Hard block: mark as blocked and output alert
      markLoopBlocked();
      
      const suggestions = generateRecoverySuggestions(loopStatus);
      const blockMessage = buildLoopBlockMessage(loopStatus, suggestions);
      
      // Output JSON with block directive
      console.log(JSON.stringify({
        block: true,
        alert: blockMessage,
        suggestions: suggestions.map(s => ({
          key: s.key,
          label: s.label,
          action: s.action
        }))
      }));
      
      process.exit(0);
    }
    
    // 2. Experience Matching
    const experiences = findExperiences({
      tool: tool_name,
      input: inputStr.slice(0, 100),
      minConfidence: 0.5,
      limit: 3
    });
    
    // 3. Consequence Prediction (for high-risk tools)
    const isHighRisk = ['Write', 'Edit', 'Bash'].includes(tool_name);
    let consequences = null;
    
    if (isHighRisk) {
      consequences = await predictConsequences(tool_name, tool_input, experiences);
    }
    
    // 4. Build context injection if relevant
    if (experiences.length > 0 || (consequences?.risks?.length > 0)) {
      const contextMessage = buildAdviceContext(experiences, consequences);
      
      // Output as additional context
      console.log(JSON.stringify({
        additionalContext: contextMessage
      }));
    }
  } catch (err) {
    if (process.env.AMB_DEBUG) {
      console.error('[AMB] Pre-tool error:', err.message);
    }
  }
}

main().catch(() => process.exit(0));
