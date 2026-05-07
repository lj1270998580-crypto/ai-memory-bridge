#!/usr/bin/env node
/**
 * forget.mjs — Delete or deprecate an experience
 * Usage: node forget.mjs \u003cid\u003e [reason]
 */

import { deleteExperience, getExperience } from '../lib/experience-store.mjs';

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: /amb:forget \u003cexperience-id\u003e [reason]');
    console.log('');
    console.log('Examples:');
    console.log('  /amb:forget exp_abc123');
    console.log('  /amb:forget exp_abc123 "No longer relevant after v2 upgrade"');
    process.exit(1);
  }
  
  const id = args[0];
  const reason = args.slice(1).join(' ');
  
  // Check if exists
  const exp = getExperience(id);
  if (!exp) {
    console.log(`❌ Experience not found: ${id}`);
    console.log('');
    console.log('Use /amb:search to find the correct ID.');
    process.exit(1);
  }
  
  // Show preview
  console.log('Experience to remove:');
  console.log(`  ID: ${exp.id}`);
  console.log(`  Type: ${exp.type}`);
  console.log(`  Scope: ${exp.scope}`);
  if (exp.lesson.what_failed) {
    console.log(`  Content: ${exp.lesson.what_failed.slice(0, 80)}`);
  }
  console.log('');
  
  // Delete
  const success = deleteExperience(id, reason);
  
  if (success) {
    if (reason) {
      console.log(`✅ Marked as deprecated: ${id}`);
      console.log(`   Reason: ${reason}`);
    } else {
      console.log(`✅ Deleted: ${id}`);
    }
  } else {
    console.log(`❌ Failed to remove: ${id}`);
  }
}

main();
