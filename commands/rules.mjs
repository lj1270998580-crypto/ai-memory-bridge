#!/usr/bin/env node
/**
 * rules.mjs — Generate Skill rules from learned experiences
 * Usage: /amb:rules [options]
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { detectProject, getStoragePaths } from '../lib/detect-project.mjs';
import { generateRules, saveRules, generateRuleIndex } from '../lib/rule-generator.mjs';

function main() {
  const args = process.argv.slice(2);
  
  const options = {
    minFrequency: 2,
    minConfidence: 0.6,
    aggregate: true,
    output: null
  };
  
  // Parse args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--min-freq') options.minFrequency = parseInt(args[++i]) || 2;
    if (arg === '--min-conf') options.minConfidence = parseFloat(args[++i]) || 0.6;
    if (arg === '--no-aggregate') options.aggregate = false;
    if (arg === '--output') options.output = args[++i];
  }
  
  console.log('📝 AI Memory Bridge: Generating Skill Rules\n');
  console.log('─'.repeat(60));
  
  const project = detectProject();
  
  // Determine output directory
  const outputDir = options.output 
    ? resolve(options.output)
    : resolve(project.project_root, '.ai-memory', 'rules');
  
  console.log(`Project: ${project.project_name}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Criteria: freq >= ${options.minFrequency}, conf >= ${options.minConfidence * 100}%`);
  console.log(`Aggregation: ${options.aggregate ? 'enabled' : 'disabled'}\n`);
  
  // Generate rules
  const rules = generateRules(options);
  
  if (rules.length === 0) {
    console.log('⚠️  No rules generated. Criteria may be too strict.');
    console.log('');
    console.log('Suggestions:');
    console.log('  • Lower thresholds: /amb:rules --min-freq 1 --min-conf 0.5');
    console.log('  • Wait for more experiences to be learned');
    console.log('  • Manually add experiences with /amb:learn');
    process.exit(0);
  }
  
  console.log(`✅ Generated ${rules.length} rule(s)\n`);
  
  // Save rules
  mkdirSync(outputDir, { recursive: true });
  const saved = saveRules(rules, outputDir);
  
  // Generate index
  const indexContent = generateRuleIndex(rules);
  const indexPath = resolve(outputDir, 'README.md');
  writeFileSync(indexPath, indexContent);
  
  // Display results
  console.log('Generated files:');
  console.log(`  📄 ${indexPath}`);
  
  const byCategory = {};
  for (const rule of saved) {
    if (!byCategory[rule.category]) byCategory[rule.category] = [];
    byCategory[rule.category].push(rule);
  }
  
  for (const [category, catRules] of Object.entries(byCategory)) {
    console.log(`\n  📁 ${category}/`);
    for (const rule of catRules) {
      console.log(`     ${rule.file} - ${rule.title}`);
    }
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log('\n💡 How to use these rules:');
  console.log('');
  console.log('Option 1: Copy to Claude Code skills directory');
  console.log(`  cp -r ${outputDir}/* ~/.claude/skills/`);
  console.log('');
  console.log('Option 2: Reference in CLAUDE.md');
  console.log('  Add to your project CLAUDE.md:');
  console.log(`  - Follow rules in ${outputDir}`);
  console.log('');
  console.log('Option 3: Keep in project (team sharing)');
  console.log('  Commit .ai-memory/rules/ to git');
  console.log('  Team members get the same rules automatically');
}

main();
