#!/usr/bin/env node
/**
 * status.mjs — Show AI Memory Bridge status
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { detectProject, getStoragePaths } from '../lib/detect-project.mjs';
import { getStats } from '../lib/experience-store.mjs';
import { getSessionStats } from '../lib/loop-detector.mjs';

function main() {
  try {
    const project = detectProject();
    const paths = getStoragePaths(project);
    const stats = getStats();
    const sessionStats = getSessionStats();
    
    console.log('🧠 AI Memory Bridge Status');
    console.log('═══════════════════════════════════════\n');
    
    // Project Info
    console.log(`Project: ${stats.project_name}`);
    console.log(`ID: ${stats.project_id}`);
    console.log(`Local Storage: ${stats.has_local_storage ? '✅' : '❌'}\n`);
    
    // Experience Counts
    console.log('📚 Experience Library');
    console.log(`  Project: ${stats.project_experiences} experiences`);
    console.log(`  Global:  ${stats.global_experiences} experiences\n`);
    
    // Session Stats
    console.log('📊 Current Session');
    console.log(`  Tool Calls: ${sessionStats.total_calls}`);
    console.log(`  Unique Tools: ${sessionStats.unique_tools}`);
    console.log(`  Failure Rate: ${(sessionStats.failure_rate * 100).toFixed(1)}%`);
    console.log(`  Loops Blocked: ${sessionStats.blocked_loops}\n`);
    
    // Recent experiences
    if (stats.project_experiences > 0) {
      console.log('📝 Recent Project Learnings');
      const expDir = paths.project.experiences;
      if (existsSync(expDir)) {
        const files = readdirSync(expDir)
          .filter(f => f.endsWith('.json'))
          .map(f => ({
            file: f,
            path: resolve(expDir, f)
          }));
        
        // Load all experiences
        const allExps = files
          .map(f => {
            try {
              const content = readFileSync(f.path, 'utf8');
              const exp = JSON.parse(content);
              return { ...f, exp };
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        
        // Show high-frequency experiences (merged)
        const highFreq = allExps
          .filter(({ exp }) => exp.frequency > 1)
          .sort((a, b) => b.exp.frequency - a.exp.frequency)
          .slice(0, 3);
        
        if (highFreq.length > 0) {
          console.log('   High Confidence (verified multiple times):');
          for (const { exp } of highFreq) {
            const type = exp.type === 'pitfall' ? '🔴' : exp.type === 'error' ? '🟡' : '🟢';
            const verified = exp.verifications ? `(${exp.verifications.length}x verified)` : '';
            console.log(`   ${type} [freq:${exp.frequency}] ${exp.lesson?.what_failed?.slice(0, 40)} ${verified}`);
          }
          console.log('');
        }
        
        // Show most recent
        const sorted = allExps
          .sort((a, b) => new Date(b.exp.updated_at) - new Date(a.exp.updated_at))
          .slice(0, 5);
        
        for (const { exp } of sorted) {
          const type = exp.type === 'pitfall' ? '🔴' : exp.type === 'error' ? '🟡' : '🟢';
          const conf = '●'.repeat(Math.ceil(exp.confidence * 5));
          const freq = exp.frequency > 1 ? `(${exp.frequency}x)` : '';
          console.log(`  ${type} [${conf}] ${freq} ${exp.lesson?.what_failed?.slice(0, 50) || exp.outcome?.description?.slice(0, 50)}`);
        }
      }
      console.log('');
    }
    
    // DNA Preview
    if (existsSync(paths.project.dna)) {
      try {
        const dna = JSON.parse(readFileSync(paths.project.dna, 'utf8'));
        if (dna.stack?.length > 0) {
          console.log('🧬 DNA Stack:', dna.stack.join(', '));
        }
        if (dna.constraints?.length > 0) {
          console.log('⛓️  Constraints:', dna.constraints.join(', '));
        }
      } catch {}
    }
    
    console.log('\n💡 Commands: /amb:learn | /amb:search | /amb:loop | /amb:dashboard');
    
  } catch (err) {
    console.error('❌ Status check failed:', err.message);
    process.exit(1);
  }
}

main();
