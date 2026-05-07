#!/usr/bin/env node
/**
 * detect-project.mjs — Project detection with git-based hashing
 * Reuses logic from continuous-learning-v2 for cross-machine consistency
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const GLOBAL_DIR = resolve(homedir(), '.claude', 'ai-memory');

/**
 * Detect current project from cwd or environment
 * @param {string} cwd — working directory (optional, defaults to process.cwd())
 * @returns {object|null} { project_id, project_name, project_root, git_remote, scope }
 */
export function detectProject(cwd = process.cwd()) {
  // 1. Try git remote for portable project ID
  let gitRemote = null;
  let gitRoot = cwd;
  
  try {
    gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf8',
      timeout: 3000
    }).trim();
    
    gitRemote = execSync('git remote get-url origin', {
      cwd: gitRoot,
      encoding: 'utf8',
      timeout: 3000
    }).trim();
  } catch {
    // Not a git repo or no remote — use path-based fallback
  }
  
  // 2. Generate project ID
  let projectId;
  let projectName;
  
  if (gitRemote) {
    // Hash of git remote URL — same repo on different machines = same ID
    projectId = 'proj_' + createHash('sha256').update(gitRemote).digest('hex').slice(0, 12);
    projectName = gitRemote.split('/').pop().replace('.git', '');
  } else {
    // Fallback: hash of absolute path (machine-specific)
    projectId = 'proj_' + createHash('sha256').update(resolve(cwd)).digest('hex').slice(0, 12);
    projectName = cwd.split(/[\\/]/).pop();
  }
  
  // 3. Check if project has local .ai-memory
  const localMemoryDir = resolve(gitRoot || cwd, '.ai-memory');
  const hasLocalStorage = existsSync(localMemoryDir);
  
  return {
    project_id: projectId,
    project_name: projectName,
    project_root: gitRoot || cwd,
    git_remote: gitRemote,
    has_local_storage: hasLocalStorage,
    local_memory_dir: localMemoryDir,
    global_memory_dir: resolve(GLOBAL_DIR, 'projects', projectId)
  };
}

/**
 * Get effective storage paths (local + global)
 */
export function getStoragePaths(project) {
  return {
    project: {
      dna: resolve(project.local_memory_dir, 'dna.json'),
      experiences: resolve(project.local_memory_dir, 'experiences'),
      decisions: resolve(project.local_memory_dir, 'decisions.jsonl')
    },
    global: {
      root: project.global_memory_dir,
      dna: resolve(project.global_memory_dir, 'dna.json'),
      experiences: resolve(project.global_memory_dir, 'experiences'),
      profile: resolve(GLOBAL_DIR, 'global', 'profile.json')
    }
  };
}

/**
 * Ensure directories exist
 */
export function ensureDirs(paths) {
  import('fs').then(({ mkdirSync }) => {
    for (const dir of Object.values(paths).flatMap(p => 
      typeof p === 'string' ? [p] : Object.values(p)
    )) {
      if (!dir.endsWith('.json') && !dir.endsWith('.jsonl')) {
        mkdirSync(dir, { recursive: true });
      }
    }
  });
}
