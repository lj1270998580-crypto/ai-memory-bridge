#!/usr/bin/env node
/**
 * promote.mjs — Promote project experience to global
 * Usage: node promote.mjs \u003cid\u003e
 */

import { getExperience, promoteExperience, findExperiences } from '../lib/experience-store.mjs';

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: /amb:promote \u003cexperience-id\u003e');
    console.log('');
    console.log('Promotes a project-scoped experience to global scope.');
    console.log('Global experiences are shared across all projects.\n');
    
    // Show candidates
    console.log('Auto-promotion criteria:');
    console.log('  • Seen in 2+ projects');
    console.log('  • Confidence >= 0.8');
    console.log('  • Frequency >= 2');
    console.log('');
    console.log('Run /amb:search to find experience IDs.');
    process.exit(1);
  }
  
  const id = args[0];
  
  // Check if exists
  const exp = getExperience(id);
  if (!exp) {
    console.log(`❌ Experience not found: ${id}`);
    process.exit(1);
  }
  
  if (exp.scope === 'global') {
    console.log(`ℹ️  Already global: ${id}`);
    process.exit(0);
  }
  
  // Show preview
  console.log('Experience to promote:');
  console.log(`  ID: ${exp.id}`);
  console.log(`  Type: ${exp.type}`);
  console.log(`  Confidence: ${exp.confidence}`);
  console.log(`  Frequency: ${exp.frequency}`);
  if (exp.lesson.what_failed) {
    console.log(`  Lesson: ${exp.lesson.what_failed.slice(0, 80)}`);
  }
  console.log('');
  
  // Promote
  const promoted = promoteExperience(id);
  
  if (promoted) {
    console.log(`✅ Promoted to global: ${promoted.id}`);
    console.log(`   Original: ${id}`);
    console.log(`   Scope: ${promoted.scope}`);
    console.log('');
    console.log('This experience will now be available in all projects.');
  } else {
    console.log(`❌ Promotion failed: ${id}`);
  }
}

main();
