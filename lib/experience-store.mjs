#!/usr/bin/env node
/**
 * experience-store.mjs — Experience storage and retrieval
 * Supports both project-local (.ai-memory/) and global (~/.claude/ai-memory/) storage
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve, basename } from 'path';
import { detectProject, getStoragePaths } from './detect-project.mjs';

const CONFIG = loadConfig();

function loadConfig() {
  try {
    const configPath = resolve(process.env.HOME || process.env.USERPROFILE, '.claude/skills/ai-memory-bridge/config.json');
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    return { experience: { max_experiences_per_project: 500, max_experiences_global: 2000 } };
  }
}

function generateId() {
  return 'exp_' + Math.random().toString(36).substring(2, 10);
}

function getTimestamp() {
  return new Date().toISOString();
}

function scrubSecrets(text) {
  if (!text || typeof text !== 'string') return text;
  let scrubbed = text;
  const patterns = [
    /(api[_-]?key|token|secret|password|authorization|credential)["'\s:=]+([A-Za-z0-9_\-/.+=]{8,})/gi,
    /(bearer\s+)([a-z0-9\-_.]+)/gi,
    /(sk-[a-z0-9]{20,})/gi
  ];
  for (const pattern of patterns) {
    scrubbed = scrubbed.replace(pattern, (match, prefix) => prefix + '[REDACTED]');
  }
  return scrubbed;
}

function summarizeInput(input, maxLen = 200) {
  if (!input) return '';
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

function extractError(output) {
  if (!output) return '';
  const str = typeof output === 'string' ? output : JSON.stringify(output);
  // Look for common error patterns
  const errorPatterns = [
    /error[:\s]+([^\n]+)/i,
    /exception[:\s]+([^\n]+)/i,
    /failed[:\s]+([^\n]+)/i,
    /ERESOLVE\s+([^\n]+)/,
    /ENOENT[:\s]+([^\n]+)/
  ];
  for (const pattern of errorPatterns) {
    const match = str.match(pattern);
    if (match) return match[1].trim();
  }
  return str.slice(0, 200);
}

/**
 * Calculate similarity between two experiences (0-1)
 */
function calculateSimilarity(exp1, exp2) {
  let score = 0;
  let weights = 0;
  
  // Tool match (weight: 0.3)
  if (exp1.trigger?.tool && exp2.trigger?.tool) {
    weights += 0.3;
    if (exp1.trigger.tool === exp2.trigger.tool) {
      score += 0.3;
    }
  }
  
  // Action pattern similarity (weight: 0.3)
  if (exp1.trigger?.action_pattern && exp2.trigger?.action_pattern) {
    weights += 0.3;
    const a1 = exp1.trigger.action_pattern.toLowerCase();
    const a2 = exp2.trigger.action_pattern.toLowerCase();
    if (a1 === a2) {
      score += 0.3;
    } else if (a1.includes(a2) || a2.includes(a1)) {
      score += 0.2;
    }
  }
  
  // Input summary similarity (weight: 0.2)
  if (exp1.trigger?.input_summary && exp2.trigger?.input_summary) {
    weights += 0.2;
    const i1 = exp1.trigger.input_summary.toLowerCase();
    const i2 = exp2.trigger.input_summary.toLowerCase();
    if (i1 === i2) {
      score += 0.2;
    } else if (i1.includes(i2) || i2.includes(i1)) {
      score += 0.15;
    }
  }
  
  // Outcome status match (weight: 0.2)
  if (exp1.outcome?.status && exp2.outcome?.status) {
    weights += 0.2;
    if (exp1.outcome.status === exp2.outcome.status) {
      score += 0.2;
    }
  }
  
  // Normalize by weights
  return weights > 0 ? score / weights : 0;
}

/**
 * Find similar existing experience
 */
function findSimilarExperience(experience, scope = 'project') {
  const project = detectProject();
  const paths = getStoragePaths(project);
  
  const searchDirs = scope === 'global' 
    ? [paths.global.experiences]
    : [paths.project.experiences, paths.global.experiences];
  
  let bestMatch = null;
  let bestScore = 0;
  const SIMILARITY_THRESHOLD = 0.75;
  
  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const existing = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
        
        // Skip deprecated experiences
        if (existing.metadata?.deprecated_by) continue;
        
        const score = calculateSimilarity(experience, existing);
        
        if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
          bestScore = score;
          bestMatch = { ...existing, _file_path: resolve(dir, file) };
        }
      } catch {
        // Skip corrupt files
      }
    }
  }
  
  return bestMatch;
}

/**
 * Merge two experiences, keeping the best lessons
 */
function mergeExperiences(existing, newExp) {
  const merged = { ...existing };
  
  // Update frequency
  merged.frequency = (existing.frequency || 1) + 1;
  
  // Increase confidence (cap at 0.95)
  merged.confidence = Math.min((existing.confidence || 0.5) + 0.08, 0.95);
  
  // Update timestamp
  merged.updated_at = getTimestamp();
  
  // Merge lessons: keep longer/more detailed ones
  if (newExp.lesson?.what_failed && 
      (!existing.lesson?.what_failed || newExp.lesson.what_failed.length > existing.lesson.what_failed.length)) {
    merged.lesson.what_failed = newExp.lesson.what_failed;
  }
  
  if (newExp.lesson?.what_worked && 
      (!existing.lesson?.what_worked || newExp.lesson.what_worked.length > existing.lesson.what_worked.length)) {
    merged.lesson.what_worked = newExp.lesson.what_worked;
  }
  
  if (newExp.lesson?.better_approach && 
      (!existing.lesson?.better_approach || newExp.lesson.better_approach.length > existing.lesson.better_approach.length)) {
    merged.lesson.better_approach = newExp.lesson.better_approach;
  }
  
  // Add verification history
  if (!merged.verifications) {
    merged.verifications = [];
  }
  merged.verifications.push({
    timestamp: getTimestamp(),
    session: newExp.metadata?.source_session || 'unknown',
    outcome: newExp.outcome?.status
  });
  
  // Keep only last 10 verifications
  if (merged.verifications.length > 10) {
    merged.verifications = merged.verifications.slice(-10);
  }
  
  // Merge tags (union)
  const existingTags = new Set(existing.metadata?.tags || []);
  const newTags = newExp.metadata?.tags || [];
  for (const tag of newTags) {
    existingTags.add(tag);
  }
  merged.metadata.tags = Array.from(existingTags);
  
  return merged;
}

/**
 * Save an experience to storage (with deduplication)
 */
export function saveExperience(experience, scope = 'project') {
  const project = detectProject();
  const paths = getStoragePaths(project);
  
  // Build the new experience object
  const newExp = {
    id: experience.id || generateId(),
    type: experience.type || 'pattern',
    scope: scope,
    project_id: project.project_id,
    created_at: experience.created_at || getTimestamp(),
    updated_at: getTimestamp(),
    confidence: experience.confidence || 0.5,
    frequency: experience.frequency || 1,
    trigger: {
      tool: experience.trigger?.tool || '',
      action_pattern: experience.trigger?.action_pattern || '',
      context_pattern: experience.trigger?.context_pattern || '',
      input_summary: scrubSecrets(summarizeInput(experience.trigger?.input))
    },
    outcome: {
      status: experience.outcome?.status || 'unknown',
      description: scrubSecrets(experience.outcome?.description || ''),
      consequences: (experience.outcome?.consequences || []).map(c => scrubSecrets(c))
    },
    lesson: {
      what_worked: scrubSecrets(experience.lesson?.what_worked || ''),
      what_failed: scrubSecrets(experience.lesson?.what_failed || ''),
      better_approach: scrubSecrets(experience.lesson?.better_approach || '')
    },
    metadata: {
      source_session: experience.metadata?.source_session || '',
      related_experiences: experience.metadata?.related_experiences || [],
      deprecated_by: experience.metadata?.deprecated_by || null,
      tags: experience.metadata?.tags || []
    }
  };
  
  // Check for similar existing experience
  const similar = findSimilarExperience(newExp, scope);
  
  if (similar) {
    // Merge with existing
    const merged = mergeExperiences(similar, newExp);
    
    // Save to same location
    writeFileSync(similar._file_path, JSON.stringify(merged, null, 2));
    
    if (process.env.AMB_DEBUG) {
      console.error(`[AMB] Merged with existing: ${merged.id} (freq=${merged.frequency}, conf=${merged.confidence.toFixed(2)})`);
    }
    
    return merged;
  }
  
  // Determine storage location
  const storageDir = scope === 'global' 
    ? paths.global.experiences 
    : paths.project.experiences;
  
  mkdirSync(storageDir, { recursive: true });
  
  const filePath = resolve(storageDir, `${newExp.id}.json`);
  writeFileSync(filePath, JSON.stringify(newExp, null, 2));
  
  return newExp;
}

/**
 * Find relevant experiences based on criteria
 */
export function findExperiences(criteria = {}) {
  const project = detectProject();
  const paths = getStoragePaths(project);
  const results = [];
  
  // Search both project and global
  const searchDirs = [paths.project.experiences];
  if (criteria.includeGlobal !== false) {
    searchDirs.push(paths.global.experiences);
  }
  
  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const exp = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
        
        // Apply filters
        if (criteria.tool && exp.trigger.tool !== criteria.tool) continue;
        if (criteria.type && exp.type !== criteria.type) continue;
        if (criteria.tags?.length && !criteria.tags.some(t => exp.metadata.tags.includes(t))) continue;
        if (criteria.minConfidence && exp.confidence < criteria.minConfidence) continue;
        
        // Calculate relevance score
        let score = 0;
        if (criteria.tool && exp.trigger.tool === criteria.tool) score += 0.4;
        if (criteria.input && exp.trigger.input_summary?.includes(criteria.input)) score += 0.3;
        if (criteria.context && exp.trigger.context_pattern?.includes(criteria.context)) score += 0.2;
        score += exp.confidence * 0.1;
        
        if (score >= (criteria.minRelevance || 0.3)) {
          results.push({ ...exp, relevance_score: score });
        }
      } catch {
        // Skip corrupt files
      }
    }
  }
  
  // Sort by relevance score descending
  return results.sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, criteria.limit || 10);
}

/**
 * Semantic search with synonym expansion
 */
const SYNONYM_MAP = {
  // Package management
  'install': ['install', 'add', 'setup', 'dependency', 'package', 'npm', 'yarn', 'pnpm'],
  'dependency': ['dependency', 'package', 'module', 'library', 'install'],
  'npm': ['npm', 'yarn', 'pnpm', 'package', 'node_modules'],
  
  // Git
  'git': ['git', 'commit', 'push', 'pull', 'merge', 'branch', 'repository'],
  'commit': ['commit', 'push', 'git', 'save', 'stage'],
  'merge': ['merge', 'conflict', 'pull', 'rebase', 'git'],
  
  // Testing
  'test': ['test', 'testing', 'spec', 'jest', 'vitest', 'mocha', 'assert'],
  'testing': ['testing', 'test', 'spec', 'coverage', 'assert'],
  
  // Build
  'build': ['build', 'compile', 'bundle', 'webpack', 'vite', 'esbuild', 'transpile'],
  'compile': ['compile', 'build', 'transpile', 'typescript', 'tsc'],
  
  // Errors
  'error': ['error', 'fail', 'failure', 'exception', 'crash', 'bug'],
  'fail': ['fail', 'failure', 'error', 'broken', 'not work'],
  
  // Security
  'auth': ['auth', 'login', 'password', 'token', 'session', 'security'],
  'security': ['security', 'auth', 'permission', 'vulnerability', 'safe'],
  
  // Database
  'database': ['database', 'db', 'sql', 'prisma', 'drizzle', 'orm', 'migration'],
  'migration': ['migration', 'migrate', 'schema', 'database', 'prisma'],
  
  // API
  'api': ['api', 'endpoint', 'route', 'controller', 'request', 'response'],
  'endpoint': ['endpoint', 'api', 'route', 'url', 'path'],
  
  // Common actions
  'run': ['run', 'execute', 'start', 'launch', 'call'],
  'fix': ['fix', 'repair', 'resolve', 'solve', 'correct', 'debug'],
  'update': ['update', 'upgrade', 'change', 'modify', 'edit'],
  'delete': ['delete', 'remove', 'drop', 'clean', 'rm'],
  'create': ['create', 'new', 'add', 'generate', 'init']
};

function expandQuery(query) {
  const words = query.toLowerCase().split(/\s+/);
  const expanded = new Set(words);
  
  for (const word of words) {
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (word.includes(key) || key.includes(word)) {
        for (const syn of synonyms) {
          expanded.add(syn);
        }
      }
    }
  }
  
  return Array.from(expanded);
}

function calculateSemanticScore(exp, queryTerms) {
  const text = [
    exp.type,
    exp.trigger?.tool || '',
    exp.trigger?.action_pattern || '',
    exp.trigger?.input_summary || '',
    exp.trigger?.context_pattern || '',
    exp.lesson?.what_failed || '',
    exp.lesson?.what_worked || '',
    exp.lesson?.better_approach || '',
    exp.outcome?.description || '',
    ...(exp.metadata?.tags || [])
  ].join(' ').toLowerCase();
  
  let matches = 0;
  for (const term of queryTerms) {
    if (text.includes(term)) {
      matches++;
    }
  }
  
  // Normalize by query length and text length
  const coverage = matches / queryTerms.length;
  const density = matches / (text.length / 50 + 1); // per 50 chars
  
  return coverage * 0.7 + density * 0.3;
}

export function semanticSearch(query, options = {}) {
  const project = detectProject();
  const paths = getStoragePaths(project);
  const queryTerms = expandQuery(query);
  
  if (process.env.AMB_DEBUG) {
    console.error('Semantic search terms:', queryTerms);
  }
  
  const allExperiences = [];
  
  // Load all experiences
  for (const dir of [paths.project.experiences, paths.global.experiences]) {
    if (!existsSync(dir)) continue;
    
    for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const exp = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
        allExperiences.push(exp);
      } catch {}
    }
  }
  
  // Calculate semantic scores
  const scored = allExperiences.map(exp => ({
    ...exp,
    semantic_score: calculateSemanticScore(exp, queryTerms),
    matched_terms: queryTerms.filter(t => {
      const text = [
        exp.type,
        exp.trigger?.tool || '',
        exp.trigger?.action_pattern || '',
        exp.lesson?.what_failed || '',
        exp.lesson?.better_approach || '',
        ...(exp.metadata?.tags || [])
      ].join(' ').toLowerCase();
      return text.includes(t);
    })
  }));
  
  // Filter and sort
  const minScore = options.minScore || 0.1;
  const results = scored
    .filter(exp => exp.semantic_score >= minScore)
    .sort((a, b) => b.semantic_score - a.semantic_score)
    .slice(0, options.limit || 10);
  
  return results;
}

/**
 * Get a single experience by ID
 */
export function getExperience(id) {
  const project = detectProject();
  const paths = getStoragePaths(project);
  
  // Check project first
  const projectPath = resolve(paths.project.experiences, `${id}.json`);
  if (existsSync(projectPath)) {
    return JSON.parse(readFileSync(projectPath, 'utf8'));
  }
  
  // Check global
  const globalPath = resolve(paths.global.experiences, `${id}.json`);
  if (existsSync(globalPath)) {
    return JSON.parse(readFileSync(globalPath, 'utf8'));
  }
  
  return null;
}

/**
 * Update an experience
 */
export function updateExperience(id, updates) {
  const exp = getExperience(id);
  if (!exp) return null;
  
  const updated = {
    ...exp,
    ...updates,
    updated_at: getTimestamp()
  };
  
  const project = detectProject();
  const paths = getStoragePaths(project);
  const storageDir = exp.scope === 'global' ? paths.global.experiences : paths.project.experiences;
  const filePath = resolve(storageDir, `${id}.json`);
  
  writeFileSync(filePath, JSON.stringify(updated, null, 2));
  return updated;
}

/**
 * Delete or deprecate an experience
 */
export function deleteExperience(id, reason = '') {
  const exp = getExperience(id);
  if (!exp) return false;
  
  const project = detectProject();
  const paths = getStoragePaths(project);
  const storageDir = exp.scope === 'global' ? paths.global.experiences : paths.project.experiences;
  const filePath = resolve(storageDir, `${id}.json`);
  
  if (reason) {
    // Mark as deprecated rather than delete
    updateExperience(id, { 
      deprecated_at: getTimestamp(),
      deprecation_reason: reason 
    });
  } else {
    unlinkSync(filePath);
  }
  
  return true;
}

/**
 * Promote project experience to global
 */
export function promoteExperience(id) {
  const exp = getExperience(id);
  if (!exp) return null;
  if (exp.scope === 'global') return exp;
  
  // Create global copy
  const globalExp = {
    ...exp,
    id: generateId(),
    scope: 'global',
    promoted_from: id,
    promoted_at: getTimestamp()
  };
  
  const saved = saveExperience(globalExp, 'global');
  
  // Mark original as promoted
  updateExperience(id, { promoted_to: saved.id });
  
  return saved;
}

/**
 * Get statistics
 */
export function getStats() {
  const project = detectProject();
  const paths = getStoragePaths(project);
  
  const countExperiences = (dir) => {
    if (!existsSync(dir)) return 0;
    return readdirSync(dir).filter(f => f.endsWith('.json')).length;
  };
  
  return {
    project_id: project.project_id,
    project_name: project.project_name,
    project_experiences: countExperiences(paths.project.experiences),
    global_experiences: countExperiences(paths.global.experiences),
    has_local_storage: project.has_local_storage
  };
}

export { generateId, getTimestamp, scrubSecrets, summarizeInput, extractError };
