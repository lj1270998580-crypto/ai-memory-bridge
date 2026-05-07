#!/usr/bin/env node
/**
 * rule-generator.mjs — Convert experiences into Claude Code Skill rules
 * Transforms high-frequency, high-confidence experiences into enforceable rules
 */

import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { detectProject, getStoragePaths } from './detect-project.mjs';

const MIN_FREQUENCY = 2;
const MIN_CONFIDENCE = 0.6;

/**
 * Categorize an experience into rule types
 */
function categorizeExperience(exp) {
  const tags = exp.metadata?.tags || [];
  const tool = exp.trigger?.tool || '';
  const action = exp.trigger?.action_pattern || '';
  const lesson = exp.lesson?.better_approach || exp.lesson?.what_failed || '';
  
  // Pitfall → pitfall-avoidance
  if (exp.type === 'pitfall') {
    return 'pitfall-avoidance';
  }
  
  // Error → error-handling
  if (exp.type === 'error') {
    return 'error-handling';
  }
  
  // Bash commands → workflow
  if (tool === 'Bash') {
    if (/git\s+(commit|push|pull|merge)/.test(action)) {
      return 'git-workflow';
    }
    if (/npm|yarn|pnpm/.test(action)) {
      return 'package-management';
    }
    if (/test|spec/.test(action)) {
      return 'testing';
    }
    if (/build|compile|bundle/.test(action)) {
      return 'build';
    }
    return 'workflow';
  }
  
  // Code-related → code-style or architecture
  if (tool === 'Write' || tool === 'Edit') {
    if (/type|interface|enum/.test(lesson)) {
      return 'type-safety';
    }
    if (/import|export|module/.test(lesson)) {
      return 'module-organization';
    }
    if (/style|format|lint/.test(lesson)) {
      return 'code-style';
    }
    return 'code-style';
  }
  
  // Grep/Read → investigation
  if (tool === 'Grep' || tool === 'Read') {
    return 'investigation';
  }
  
  return 'general';
}

/**
 * Generate rule title from experience
 */
function generateRuleTitle(exp) {
  const lesson = exp.lesson?.better_approach || exp.lesson?.what_failed || '';
  const tool = exp.trigger?.tool || '';
  const action = exp.trigger?.action_pattern || '';
  
  // Extract key verb + object
  const patterns = [
    /使用\s+(\S+)/,
    /添加\s+(\S+)/,
    /避免\s+(\S+)/,
    /不要\s+(\S+)/,
    /先\s+(\S+)/,
    /运行\s+(\S+)/,
    /检查\s+(\S+)/,
    /确保\s+(\S+)/
  ];
  
  for (const pattern of patterns) {
    const match = lesson.match(pattern);
    if (match) {
      return `${match[1]}规范`;
    }
  }
  
  // Fallback: use tool + action
  const actionVerb = action.match(/^\s*(\S+)/)?.[1] || tool;
  return `${actionVerb}操作规范`;
}

/**
 * Generate rule description
 */
function generateRuleDescription(exp) {
  const whatFailed = exp.lesson?.what_failed || '';
  const betterApproach = exp.lesson?.better_approach || '';
  
  if (betterApproach) {
    return `${whatFailed.slice(0, 50)} → ${betterApproach.slice(0, 50)}`;
  }
  
  return whatFailed.slice(0, 100) || exp.outcome?.description?.slice(0, 100) || '经验规则';
}

/**
 * Generate when-to-apply conditions
 */
function generateWhenToApply(exp) {
  const conditions = [];
  const tool = exp.trigger?.tool || '';
  const action = exp.trigger?.action_pattern || '';
  const context = exp.trigger?.context_pattern || '';
  
  if (tool) {
    conditions.push(`使用 ${tool} 工具时`);
  }
  
  if (action) {
    const actionVerb = action.match(/^\s*(\S+)/)?.[1] || action;
    conditions.push(`执行 ${actionVerb} 操作时`);
  }
  
  if (context) {
    conditions.push(`在 ${context} 环境下`);
  }
  
  if (conditions.length === 0) {
    conditions.push('相关场景下');
  }
  
  return conditions;
}

/**
 * Extract specific rules from experience
 */
function extractRulesFromExperience(exp) {
  const rules = [];
  const whatFailed = exp.lesson?.what_failed || '';
  const betterApproach = exp.lesson?.better_approach || '';
  const whatWorked = exp.lesson?.what_worked || '';
  
  // Convert lesson into actionable rules
  if (betterApproach) {
    // Extract imperative sentences
    const sentences = betterApproach
      .split(/[。；;]/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
    
    for (const sentence of sentences.slice(0, 3)) {
      rules.push(sentence);
    }
  }
  
  if (whatWorked) {
    const sentences = whatWorked
      .split(/[。；;]/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
    
    for (const sentence of sentences.slice(0, 2)) {
      if (!rules.includes(sentence)) {
        rules.push(sentence);
      }
    }
  }
  
  // Add prevention rule
  if (whatFailed) {
    const prevention = whatFailed
      .replace(/未处理/, '必须处理')
      .replace(/直接/, '不要直接')
      .replace(/忘记/, '不要忘记');
    
    if (prevention !== whatFailed && !rules.includes(prevention)) {
      rules.push(prevention);
    }
  }
  
  return rules.length > 0 ? rules : ['遵循最佳实践'];
}

/**
 * Generate examples (good/bad) from experience
 */
function generateExamples(exp) {
  const examples = [];
  const action = exp.trigger?.action_pattern || '';
  const betterApproach = exp.lesson?.better_approach || '';
  
  if (exp.type === 'pitfall' || exp.type === 'error') {
    // Bad example: what failed
    const badAction = action.match(/\{[^}]*command[^:]*:\s*"([^"]+)"\}/)?.[1] || action;
    if (badAction) {
      examples.push({
        type: 'bad',
        description: '导致问题的方式',
        code: badAction
      });
    }
    
    // Good example: better approach
    if (betterApproach) {
      const goodPattern = betterApproach.match(/(--[\w-]+)/)?.[0];
      if (goodPattern) {
        examples.push({
          type: 'good',
          description: '推荐方式',
          code: badAction.replace(/^(\S+)/, `$1 ${goodPattern}`)
        });
      }
    }
  }
  
  return examples;
}

/**
 * Generate a single SKILL.md rule file from experience
 */
function generateRuleFile(exp) {
  const category = categorizeExperience(exp);
  const title = generateRuleTitle(exp);
  const description = generateRuleDescription(exp);
  const whenToApply = generateWhenToApply(exp);
  const rules = extractRulesFromExperience(exp);
  const examples = generateExamples(exp);
  
  const ruleId = `amb-rule-${exp.id.replace('exp_', '')}`;
  
  let content = `---
name: ${ruleId}
description: ${description}
category: ${category}
source: ai-memory-bridge
confidence: ${(exp.confidence * 100).toFixed(0)}%
frequency: ${exp.frequency}
---

# ${title}

## When to Apply

${whenToApply.map(w => `- ${w}`).join('\n')}

## Rules

${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

`;

  if (examples.length > 0) {
    content += `## Examples\n\n`;
    
    for (const ex of examples) {
      const label = ex.type === 'good' ? '✅ Good' : '❌ Bad';
      content += `${label}:\n\`\`\`bash\n${ex.code}\n\`\`\`\n\n`;
    }
  }
  
  content += `## Rationale

This rule was automatically generated from ${exp.frequency} observed instance(s) 
with ${(exp.confidence * 100).toFixed(0)}% confidence.

Original lesson: ${exp.lesson?.what_failed || 'N/A'}
`;

  return {
    id: ruleId,
    category,
    title,
    content
  };
}

/**
 * Aggregate similar experiences into a single rule
 */
function aggregateRules(experiences) {
  const byCategory = {};
  
  for (const exp of experiences) {
    const category = categorizeExperience(exp);
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(exp);
  }
  
  const aggregated = [];
  
  for (const [category, exps] of Object.entries(byCategory)) {
    if (exps.length === 1) {
      // Single experience → single rule
      aggregated.push(generateRuleFile(exps[0]));
    } else {
      // Multiple experiences → aggregate into one rule
      const bestExp = exps.reduce((best, current) => 
        (current.confidence * current.frequency) > (best.confidence * best.frequency) ? current : best
      );
      
      const rule = generateRuleFile(bestExp);
      rule.title = `${category}规范 (${exps.length}条经验聚合)`;
      rule.aggregated = true;
      rule.sourceCount = exps.length;
      
      // Add all lessons as rules
      const allRules = new Set();
      for (const exp of exps) {
        const rules = extractRulesFromExperience(exp);
        for (const r of rules) {
          allRules.add(r);
        }
      }
      
      // Rebuild content with aggregated rules
      let content = `---
name: ${rule.id}-aggregated
description: ${rule.description}
category: ${category}
source: ai-memory-bridge
aggregated: true
source-count: ${exps.length}
---

# ${rule.title}

## When to Apply

${generateWhenToApply(bestExp).map(w => `- ${w}`).join('\n')}

## Rules

${Array.from(allRules).map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Rationale

This rule aggregates ${exps.length} related experiences:

${exps.map(exp => `- ${exp.lesson?.what_failed || 'N/A'} (freq=${exp.frequency}, conf=${(exp.confidence * 100).toFixed(0)}%)`).join('\n')}
`;

      rule.content = content;
      aggregated.push(rule);
    }
  }
  
  return aggregated;
}

/**
 * Generate all rules from experiences
 */
export function generateRules(options = {}) {
  const project = detectProject();
  const paths = getStoragePaths(project);
  const experiences = [];
  
  // Load all experiences
  for (const dir of [paths.project.experiences, paths.global.experiences]) {
    if (!existsSync(dir)) continue;
    
    for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const exp = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
        
        // Filter by criteria
        if (exp.frequency < (options.minFrequency || MIN_FREQUENCY)) continue;
        if (exp.confidence < (options.minConfidence || MIN_CONFIDENCE)) continue;
        if (exp.metadata?.deprecated_by) continue;
        
        experiences.push(exp);
      } catch {}
    }
  }
  
  if (experiences.length === 0) {
    return [];
  }
  
  // Generate rules
  const rules = options.aggregate !== false 
    ? aggregateRules(experiences)
    : experiences.map(generateRuleFile);
  
  return rules;
}

/**
 * Save rules to disk
 */
export function saveRules(rules, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  
  const saved = [];
  
  for (const rule of rules) {
    const fileName = `${rule.id}.md`;
    const filePath = resolve(outputDir, fileName);
    
    writeFileSync(filePath, rule.content);
    saved.push({
      id: rule.id,
      file: fileName,
      path: filePath,
      category: rule.category,
      title: rule.title
    });
  }
  
  return saved;
}

/**
 * Generate a master rule index
 */
export function generateRuleIndex(rules) {
  const byCategory = {};
  
  for (const rule of rules) {
    if (!byCategory[rule.category]) {
      byCategory[rule.category] = [];
    }
    byCategory[rule.category].push(rule);
  }
  
  let content = `# AI Memory Bridge - Generated Rules\n\n`;
  content += `Auto-generated from learned experiences.\n`;
  content += `Do not edit manually - regenerate with \`/amb:rules\`.\n\n`;
  
  content += `## Categories\n\n`;
  
  for (const [category, catRules] of Object.entries(byCategory)) {
    content += `### ${category}\n\n`;
    for (const rule of catRules) {
      content += `- [${rule.title}](${rule.id}.md)\n`;
    }
    content += '\n';
  }
  
  content += `## Statistics\n\n`;
  content += `- Total rules: ${rules.length}\n`;
  content += `- Categories: ${Object.keys(byCategory).length}\n`;
  
  return content;
}
