#!/usr/bin/env node
/**
 * learn.mjs — Manually record an experience
 * Usage: node learn.mjs "description" [type] [tags...]
 */

import { saveExperience } from '../lib/experience-store.mjs';

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: /amb:learn "\u003cdescription\u003e" [type] [tags...]');
    console.log('');
    console.log('Examples:');
    console.log('  /amb:learn "npm install 时要加 --legacy-peer-deps"');
    console.log('  /amb:learn "不要直接修改 node_modules" pitfall npm');
    process.exit(1);
  }
  
  const description = args[0];
  const type = args[1] || 'pattern';
  const tags = args.slice(2);
  
  // Parse description to extract lesson components
  const lesson = parseDescription(description);
  
  const experience = {
    type: type,
    trigger: {
      tool: 'Manual',
      action_pattern: description.slice(0, 50),
      context_pattern: tags.join(',')
    },
    outcome: {
      status: type === 'pitfall' ? 'failure' : 'success',
      description: description,
      consequences: []
    },
    lesson: lesson,
    metadata: {
      tags: ['manual', ...tags],
      source_session: ''
    },
    confidence: 0.9  // Manual entries start with high confidence
  };
  
  const saved = saveExperience(experience, 'project');
  
  console.log('✅ Experience recorded');
  console.log(`  ID: ${saved.id}`);
  console.log(`  Type: ${saved.type}`);
  console.log(`  Scope: ${saved.scope}`);
  console.log(`  Confidence: ${saved.confidence}`);
  
  if (saved.lesson.what_failed) {
    console.log(`  What to avoid: ${saved.lesson.what_failed}`);
  }
  if (saved.lesson.better_approach) {
    console.log(`  Better approach: ${saved.lesson.better_approach}`);
  }
}

function parseDescription(description) {
  // Try to extract structured lesson from description
  const lesson = {
    what_failed: '',
    what_worked: '',
    better_approach: ''
  };
  
  // Look for patterns like "不要...要..." or "避免...建议..."
  const avoidMatch = description.match(/(?:不要|避免|别|切忌)\s*([^，。]+)/);
  if (avoidMatch) {
    lesson.what_failed = avoidMatch[1].trim();
  }
  
  const betterMatch = description.match(/(?:应该|建议|最好|推荐)\s*([^，。]+)/);
  if (betterMatch) {
    lesson.better_approach = betterMatch[1].trim();
  }
  
  // If no structured parsing, use whole description
  if (!lesson.what_failed && !lesson.better_approach) {
    lesson.what_failed = description;
  }
  
  return lesson;
}

main();
