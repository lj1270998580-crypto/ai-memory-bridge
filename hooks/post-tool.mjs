#!/usr/bin/env node
/**
 * post-tool.mjs — PostToolUse Hook
 * Automatically learns from tool execution outcomes
 */

import { readFileSync } from 'fs';
import { detectProject } from '../lib/detect-project.mjs';
import { classifyOutcome, determineScope } from '../lib/outcome-classifier.mjs';
import { saveExperience, extractError } from '../lib/experience-store.mjs';
import { recordExecution } from '../lib/loop-detector.mjs';

async function main() {
  try {
    // Read hook data from stdin
    const stdin = readFileSync(0, 'utf8');
    if (!stdin.trim()) {
      process.exit(0);
    }
    
    const data = JSON.parse(stdin);
    const { tool_name, tool_input, tool_output, session_id } = data;
    
    if (!tool_name) {
      process.exit(0);
    }
    
    // 1. Classify outcome
    const outcome = classifyOutcome(tool_name, tool_input, tool_output);
    
    // 2. Record in session history (for loop detection)
    recordExecution(tool_name, tool_input, tool_output, outcome);
    
    // 3. Auto-extract experience if worth recording
    if (outcome.is_worth_recording) {
      const project = detectProject();
      
      const experience = {
        type: outcome.is_pitfall ? 'pitfall' : (outcome.status === 'failure' ? 'error' : 'pattern'),
        trigger: {
          tool: tool_name,
          action_pattern: extractActionPattern(tool_name, tool_input),
          context_pattern: extractContextPattern(tool_input),
          input: tool_input
        },
        outcome: {
          status: outcome.status,
          description: outcome.errors[0] || outcome.successes[0] || outcome.output_summary,
          consequences: extractConsequences(outcome)
        },
        lesson: outcome.lesson_hint || {
          what_failed: outcome.status === 'failure' ? '执行失败' : '',
          what_worked: outcome.status === 'success' ? '执行成功' : '',
          better_approach: ''
        },
        metadata: {
          source_session: session_id || '',
          tags: extractTags(tool_name, tool_input, outcome)
        }
      };
      
      // Determine scope
      const scope = determineScope(experience);
      
      // Save experience
      const saved = saveExperience(experience, scope);
      
      // Optional: output debug info
      if (process.env.AMB_DEBUG) {
        console.error(`[AMB] Learned: ${saved.id} (${saved.type}, ${scope})`);
      }
    }
  } catch (err) {
    // Fail silently in production, log in debug
    if (process.env.AMB_DEBUG) {
      console.error('[AMB] Post-tool error:', err.message);
    }
  }
}

function extractActionPattern(tool, input) {
  if (!input) return '';
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  
  // Extract command/action from input
  if (tool === 'Bash') {
    const cmd = str.match(/^\s*(\S+)(?:\s+(.{0,50}))?/);
    return cmd ? `${cmd[1]} ${cmd[2] || ''}`.trim() : str.slice(0, 50);
  }
  
  if (tool === 'Write' || tool === 'Edit') {
    const file = str.match(/["']?(?:file|path)?:?\s*["']?([^"'\n]+)/);
    return file ? `${tool} ${file[1]}` : `${tool} file`;
  }
  
  return str.slice(0, 50);
}

function extractContextPattern(input) {
  if (!input) return '';
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  
  // Detect context from keywords
  const contexts = [];
  if (/package\.json|node_modules|npm|yarn/.test(str)) contexts.push('nodejs');
  if (/requirements\.txt|pip|python/.test(str)) contexts.push('python');
  if (/docker|dockerfile|compose/.test(str)) contexts.push('docker');
  if (/git\s+(commit|push|pull|merge)/.test(str)) contexts.push('git');
  if (/test|spec|jest|pytest/.test(str)) contexts.push('testing');
  if (/build|compile|bundle|webpack/.test(str)) contexts.push('build');
  if (/deploy|publish|release/.test(str)) contexts.push('deploy');
  
  return contexts.join(',');
}

function extractConsequences(outcome) {
  const consequences = [];
  
  if (outcome.status === 'failure') {
    consequences.push('操作未完成');
    if (outcome.errors.some(e => /permission|access/i.test(e))) {
      consequences.push('可能需要权限调整');
    }
    if (outcome.errors.some(e => /not found|ENOENT/i.test(e))) {
      consequences.push('可能需要创建缺失文件/目录');
    }
  }
  
  if (outcome.is_pitfall) {
    consequences.push('存在潜在副作用或后续问题');
  }
  
  return consequences;
}

function extractTags(tool, input, outcome) {
  const tags = [tool.toLowerCase()];
  
  // Extract tool-specific tags from input
  if (tool === 'Bash' && input?.command) {
    const cmd = input.command.match(/^\s*(\S+)/);
    if (cmd) tags.push(cmd[1]);
  }
  
  // Add status tag
  tags.push(outcome.status);
  
  // Add type tag
  if (outcome.is_pitfall) tags.push('pitfall');
  if (outcome.is_new_pattern) tags.push('new-pattern');
  
  return tags;
}

main().catch(() => process.exit(0));
