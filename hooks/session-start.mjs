#!/usr/bin/env node
/**
 * session-start.mjs — SessionStart Hook
 * Loads project DNA and developer profile at session start
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { detectProject, getStoragePaths } from '../lib/detect-project.mjs';
import { getCompactionStats } from '../lib/compaction.mjs';

function main() {
  try {
    // Read session data from stdin
    const stdin = readFileSync(0, 'utf8');
    const sessionData = stdin.trim() ? JSON.parse(stdin) : {};
    
    // Detect project
    const project = detectProject();
    const paths = getStoragePaths(project);
    
    const contextParts = [];
    
    // 1. Load Project DNA
    if (existsSync(paths.project.dna)) {
      try {
        const dna = JSON.parse(readFileSync(paths.project.dna, 'utf8'));
        
        contextParts.push('─── Project DNA ───');
        contextParts.push(`Project: ${dna.name || project.project_name}`);
        
        if (dna.stack?.length > 0) {
          contextParts.push(`Stack: ${dna.stack.join(', ')}`);
        }
        
        if (dna.goal) {
          contextParts.push(`Goal: ${dna.goal}`);
        }
        
        if (dna.constraints?.length > 0) {
          contextParts.push(`Constraints:`);
          for (const constraint of dna.constraints.slice(0, 5)) {
            contextParts.push(`  • ${constraint}`);
          }
        }
        
        if (dna.pain_points?.length > 0) {
          contextParts.push(`Active Pain Points:`);
          for (const pain of dna.pain_points.slice(0, 3)) {
            contextParts.push(`  ⚠️ ${pain}`);
          }
        }
        
        contextParts.push('');
      } catch {
        // Invalid DNA file
      }
    }
    
    // 2. Load Developer Profile
    if (existsSync(paths.global.profile)) {
      try {
        const profile = JSON.parse(readFileSync(paths.global.profile, 'utf8'));
        
        contextParts.push('─── Developer Profile ───');
        
        if (profile.coding_style) {
          contextParts.push('Coding Style:');
          for (const [key, value] of Object.entries(profile.coding_style)) {
            contextParts.push(`  ${key}: ${value}`);
          }
        }
        
        if (profile.preferences) {
          contextParts.push('Preferences:');
          for (const [key, value] of Object.entries(profile.preferences)) {
            contextParts.push(`  ${key}: ${value}`);
          }
        }
        
        contextParts.push('');
      } catch {
        // Invalid profile
      }
    }
    
    // 3. Load recent experiences (last 3)
    if (existsSync(paths.project.experiences)) {
      try {
        const { readdirSync } = require('fs');
        const expFiles = readdirSync(paths.project.experiences)
          .filter(f => f.endsWith('.json'))
          .map(f => ({
            name: f,
            path: resolve(paths.project.experiences, f),
            mtime: readFileSync(resolve(paths.project.experiences, f)).mtime
          }))
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 3);
        
        if (expFiles.length > 0) {
          contextParts.push('─── Recent Learnings ───');
          
          for (const expFile of expFiles) {
            try {
              const exp = JSON.parse(readFileSync(expFile.path, 'utf8'));
              if (exp.lesson?.what_failed) {
                contextParts.push(`  • ${exp.lesson.what_failed.slice(0, 80)}`);
              }
            } catch {
              // Skip invalid files
            }
          }
          
          contextParts.push('');
        }
      } catch {
        // No experiences yet
      }
    }
    
    // 4. Check if compaction is needed
    try {
      const projectStats = getCompactionStats('project');
      const globalStats = getCompactionStats('global');
      
      if (projectStats.needs_compaction || globalStats.needs_compaction) {
        contextParts.push('─── Maintenance ───');
        
        if (projectStats.needs_compaction) {
          contextParts.push(`  🧹 Project memory needs compaction (${projectStats.active} experiences)`);
          contextParts.push(`    Run: /amb:compact`);
        }
        
        if (globalStats.needs_compaction) {
          contextParts.push(`  🧹 Global memory needs compaction (${globalStats.active} experiences)`);
          contextParts.push(`    Run: /amb:compact --global`);
        }
        
        contextParts.push('');
      }
    } catch {
      // Ignore compaction check errors
    }
    
    // 5. Build output
    if (contextParts.length > 0) {
      const fullContext = contextParts.join('\n');
      
      console.log(JSON.stringify({
        additionalContext: `\n${fullContext}\n─── End Context ───\n`
      }));
    }
  } catch (err) {
    if (process.env.AMB_DEBUG) {
      console.error('[AMB] Session start error:', err.message);
    }
  }
}

main();
