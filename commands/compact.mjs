#!/usr/bin/env node
/**
 * compact.mjs — /amb:compact command
 * Manual or automatic memory compaction
 */

import { compactMemory, getCompactionStats } from '../lib/compaction.mjs';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-n');
  const scope = args.includes('--global') || args.includes('-g') ? 'global' : 'project';
  const both = args.includes('--both') || args.includes('-b');
  
  console.log('🧹 AI Memory Bridge — Compaction\n');
  
  try {
    if (both) {
      // Compact both project and global
      const projectReport = compactMemory('project', dryRun);
      const globalReport = compactMemory('global', dryRun);
      
      printReport('Project', projectReport, dryRun);
      console.log('');
      printReport('Global', globalReport, dryRun);
    } else {
      // Compact single scope
      const report = compactMemory(scope, dryRun);
      printReport(scope.charAt(0).toUpperCase() + scope.slice(1), report, dryRun);
    }
    
    // Show stats
    console.log('\n📊 Current Stats:');
    const projectStats = getCompactionStats('project');
    const globalStats = getCompactionStats('global');
    
    console.log(`  Project: ${projectStats.active} active, ${projectStats.archived} archived`);
    if (projectStats.last_compaction) {
      console.log(`    Last compaction: ${projectStats.last_compaction}`);
    }
    
    console.log(`  Global:  ${globalStats.active} active, ${globalStats.archived} archived`);
    if (globalStats.last_compaction) {
      console.log(`    Last compaction: ${globalStats.last_compaction}`);
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (process.env.AMB_DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

function printReport(label, report, dryRun) {
  const action = dryRun ? 'Analysis' : 'Compaction';
  console.log(`${dryRun ? '🔍' : '✅'} ${action} Report: ${label}`);
  console.log(`   Scope: ${report.scope}`);
  console.log(`   Action: ${report.action}`);
  
  if (report.experience_count !== undefined) {
    console.log(`   Experiences: ${report.experience_count} active`);
  }
  
  if (report.changes && report.changes.length > 0) {
    console.log(`   Changes: ${report.changes.length}`);
    
    const summary = report.summary || {};
    for (const [type, count] of Object.entries(summary)) {
      const icon = {
        merge: '🔗',
        promote: '⬆️',
        archive: '📦',
        remove: '🗑️'
      }[type] || '📝';
      console.log(`     ${icon} ${type}: ${count}`);
    }
    
    // Show details in debug mode
    if (process.env.AMB_DEBUG) {
      console.log('\n   Details:');
      for (const change of report.changes.slice(0, 10)) {
        console.log(`     ${change.type}: ${change.action} ${change.id} (${change.reason})`);
      }
      if (report.changes.length > 10) {
        console.log(`     ... and ${report.changes.length - 10} more`);
      }
    }
  } else {
    console.log('   Changes: none needed');
  }
  
  if (report.reason) {
    console.log(`   Note: ${report.reason}`);
  }
}

main();
