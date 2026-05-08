#!/usr/bin/env node
/**
 * compaction.mjs — Memory compaction and organization
 * Automatically organizes, deduplicates, and upgrades experiences
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  statSync
} from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// Compaction configuration
const COMPACTION_CONFIG = {
  // Deduplication: merge experiences with similar triggers
  similarity_threshold: 0.75,
  
  // Auto-promotion: project -> global
  auto_promote_frequency: 5,      // Promote if frequency >= 5
  auto_promote_confidence: 0.8,   // Promote if confidence >= 0.8
  auto_promote_age_days: 7,       // Promote if older than 7 days
  
  // Archival: move old/unused experiences
  archive_after_days: 90,         // Archive after 90 days
  archive_confidence_threshold: 0.3, // Archive if confidence below this
  
  // Cleanup
  remove_deprecated_after_days: 180, // Remove deprecated after 6 months
  min_confidence: 0.2             // Remove experiences below this
};

/**
 * Compact project or global memory
 * @param {string} scope - 'project' or 'global'
 * @param {boolean} dryRun - If true, only report what would be done
 * @returns {object} Compaction report
 */
export function compactMemory(scope = 'project', dryRun = false) {
  const storagePath = getStoragePath(scope);
  const experiencesDir = join(storagePath, 'experiences');
  
  if (!existsSync(experiencesDir)) {
    return {
      scope,
      action: 'none',
      reason: 'No experiences directory found',
      changes: []
    };
  }
  
  const changes = [];
  
  // 1. Load all experiences
  const experiences = loadExperiences(experiencesDir);
  
  if (experiences.length === 0) {
    return {
      scope,
      action: 'none',
      reason: 'No experiences to compact',
      changes: []
    };
  }
  
  // 2. Deduplicate similar experiences
  const dedupResult = deduplicateExperiences(experiences, dryRun);
  changes.push(...dedupResult.changes);
  experiences.length = 0;
  experiences.push(...dedupResult.kept);
  
  // 3. Auto-promote project experiences to global
  if (scope === 'project') {
    const promoteResult = autoPromoteExperiences(experiences, dryRun);
    changes.push(...promoteResult.changes);
    // Remove promoted from project
    const promotedIds = new Set(promoteResult.promoted.map(e => e.id));
    const remaining = experiences.filter(e => !promotedIds.has(e.id));
    experiences.length = 0;
    experiences.push(...remaining);
  }
  
  // 4. Archive old experiences
  const archiveResult = archiveOldExperiences(experiences, storagePath, dryRun);
  changes.push(...archiveResult.changes);
  
  // 5. Remove deprecated experiences
  const cleanupResult = cleanupDeprecated(experiences, dryRun);
  changes.push(...cleanupResult.changes);
  
  // 6. Save compacted experiences
  if (!dryRun) {
    saveExperiences(experiences, experiencesDir);
    
    // Update metadata
    updateCompactionMetadata(storagePath, {
      last_compaction: new Date().toISOString(),
      experience_count: experiences.length,
      changes_made: changes.length
    });
  }
  
  return {
    scope,
    action: dryRun ? 'analysis' : 'compacted',
    experience_count: experiences.length,
    changes,
    summary: generateSummary(changes)
  };
}

/**
 * Deduplicate similar experiences by merging them
 */
function deduplicateExperiences(experiences, dryRun) {
  const changes = [];
  const kept = [];
  const merged = new Set();
  
  for (let i = 0; i < experiences.length; i++) {
    if (merged.has(i)) continue;
    
    const exp = experiences[i];
    const duplicates = [];
    
    for (let j = i + 1; j < experiences.length; j++) {
      if (merged.has(j)) continue;
      
      const other = experiences[j];
      const similarity = calculateSimilarity(exp, other);
      
      if (similarity >= COMPACTION_CONFIG.similarity_threshold) {
        duplicates.push({ index: j, experience: other, similarity });
      }
    }
    
    if (duplicates.length > 0) {
      // Merge duplicates into the first one
      const mergedExp = mergeExperiences(exp, duplicates.map(d => d.experience));
      
      if (!dryRun) {
        kept.push(mergedExp);
      } else {
        changes.push({
          type: 'merge',
          action: 'would_merge',
          primary: exp.id,
          merged: duplicates.map(d => d.experience.id),
          new_frequency: mergedExp.frequency,
          new_confidence: mergedExp.confidence
        });
      }
      
      duplicates.forEach(d => merged.add(d.index));
    } else {
      kept.push(exp);
    }
  }
  
  return { kept, changes };
}

/**
 * Calculate similarity between two experiences (0-1)
 */
function calculateSimilarity(a, b) {
  let score = 0;
  let weights = 0;
  
  // Tool match (weight: 0.3)
  if (a.trigger?.tool === b.trigger?.tool) {
    score += 0.3;
  }
  weights += 0.3;
  
  // Action pattern match (weight: 0.3)
  const actionA = a.trigger?.action_pattern || '';
  const actionB = b.trigger?.action_pattern || '';
  const actionSim = stringSimilarity(actionA, actionB);
  score += actionSim * 0.3;
  weights += 0.3;
  
  // Error/outcome match (weight: 0.2)
  const outcomeA = a.outcome?.description || '';
  const outcomeB = b.outcome?.description || '';
  const outcomeSim = stringSimilarity(outcomeA, outcomeB);
  score += outcomeSim * 0.2;
  weights += 0.2;
  
  // Lesson match (weight: 0.2)
  const lessonA = JSON.stringify(a.lesson || {});
  const lessonB = JSON.stringify(b.lesson || {});
  const lessonSim = stringSimilarity(lessonA, lessonB);
  score += lessonSim * 0.2;
  weights += 0.2;
  
  return weights > 0 ? score / weights : 0;
}

/**
 * Simple string similarity (Jaccard on words)
 */
function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Merge multiple experiences into one
 */
function mergeExperiences(primary, duplicates) {
  const merged = { ...primary };
  
  // Sum frequencies
  merged.frequency = (merged.frequency || 1) + 
    duplicates.reduce((sum, d) => sum + (d.frequency || 1), 0);
  
  // Increase confidence (cap at 0.95)
  const confidenceBoost = duplicates.length * 0.05;
  merged.confidence = Math.min(0.95, (merged.confidence || 0.5) + confidenceBoost);
  
  // Merge tags
  const allTags = new Set([
    ...(merged.metadata?.tags || []),
    ...duplicates.flatMap(d => d.metadata?.tags || [])
  ]);
  merged.metadata = {
    ...merged.metadata,
    tags: Array.from(allTags)
  };
  
  // Merge validation history
  const allValidated = [
    ...(merged.validated || []),
    ...duplicates.flatMap(d => d.validated || [])
  ];
  if (allValidated.length > 0) {
    merged.validated = allValidated.slice(-10); // Keep last 10
  }
  
  // Update timestamp
  merged.updated_at = new Date().toISOString();
  
  // Mark as merged
  merged.merged_from = duplicates.map(d => d.id);
  
  return merged;
}

/**
 * Auto-promote project experiences to global
 */
function autoPromoteExperiences(experiences, dryRun) {
  const changes = [];
  const promoted = [];
  
  for (const exp of experiences) {
    const freq = exp.frequency || 1;
    const conf = exp.confidence || 0.5;
    const age = getAgeInDays(exp.created_at);
    
    const shouldPromote = (
      freq >= COMPACTION_CONFIG.auto_promote_frequency ||
      conf >= COMPACTION_CONFIG.auto_promote_confidence
    ) && age >= COMPACTION_CONFIG.auto_promote_age_days;
    
    if (shouldPromote) {
      const globalExp = { ...exp, scope: 'global', promoted_from: exp.id };
      
      if (!dryRun) {
        // Save to global storage
        const globalPath = getStoragePath('global');
        const globalExpDir = join(globalPath, 'experiences');
        if (!existsSync(globalExpDir)) mkdirSync(globalExpDir, { recursive: true });
        
        writeFileSync(
          join(globalExpDir, `${globalExp.id}.json`),
          JSON.stringify(globalExp, null, 2)
        );
      }
      
      changes.push({
        type: 'promote',
        action: dryRun ? 'would_promote' : 'promoted',
        id: exp.id,
        reason: `frequency=${freq}, confidence=${conf.toFixed(2)}, age=${age}d`
      });
      
      promoted.push(exp);
    }
  }
  
  return { changes, promoted };
}

/**
 * Archive old or low-confidence experiences
 */
function archiveOldExperiences(experiences, storagePath, dryRun) {
  const changes = [];
  const archiveDir = join(storagePath, 'archive');
  
  for (const exp of experiences) {
    const age = getAgeInDays(exp.created_at);
    const conf = exp.confidence || 0.5;
    
    const shouldArchive = age > COMPACTION_CONFIG.archive_after_days ||
                         conf < COMPACTION_CONFIG.archive_confidence_threshold;
    
    if (shouldArchive) {
      if (!dryRun) {
        if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });
        
        // Move to archive
        writeFileSync(
          join(archiveDir, `${exp.id}.json`),
          JSON.stringify({ ...exp, archived_at: new Date().toISOString() }, null, 2)
        );
      }
      
      changes.push({
        type: 'archive',
        action: dryRun ? 'would_archive' : 'archived',
        id: exp.id,
        reason: `age=${age}d, confidence=${conf.toFixed(2)}`
      });
    }
  }
  
  return { changes };
}

/**
 * Remove deprecated or very low-confidence experiences
 */
function cleanupDeprecated(experiences, dryRun) {
  const changes = [];
  
  for (const exp of experiences) {
    const age = getAgeInDays(exp.created_at);
    const conf = exp.confidence || 0.5;
    
    const shouldRemove = (
      (exp.deprecated || exp.type === 'deprecated') &&
      age > COMPACTION_CONFIG.remove_deprecated_after_days
    ) || conf < COMPACTION_CONFIG.min_confidence;
    
    if (shouldRemove) {
      changes.push({
        type: 'remove',
        action: dryRun ? 'would_remove' : 'removed',
        id: exp.id,
        reason: `deprecated=${!!exp.deprecated}, age=${age}d, confidence=${conf.toFixed(2)}`
      });
    }
  }
  
  return { changes };
}

/**
 * Load all experiences from directory
 */
function loadExperiences(dir) {
  if (!existsSync(dir)) return [];
  
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  
  return files.map(f => {
    try {
      return JSON.parse(readFileSync(join(dir, f), 'utf8'));
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Save experiences to directory
 */
function saveExperiences(experiences, dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  
  // Clear old files
  const oldFiles = readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const f of oldFiles) {
    try { require('fs').unlinkSync(join(dir, f)); } catch {}
  }
  
  // Write new files
  for (const exp of experiences) {
    writeFileSync(
      join(dir, `${exp.id}.json`),
      JSON.stringify(exp, null, 2)
    );
  }
}

/**
 * Update compaction metadata
 */
function updateCompactionMetadata(storagePath, metadata) {
  const metaPath = join(storagePath, 'compaction.json');
  writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
}

/**
 * Get storage path for scope
 */
function getStoragePath(scope) {
  if (scope === 'global') {
    return join(homedir(), '.claude', 'ai-memory', 'global');
  }
  
  // Project scope
  const cwd = process.cwd();
  const localPath = join(cwd, '.ai-memory');;
  if (existsSync(localPath)) return localPath;
  
  // Fallback to global projects
  return join(homedir(), '.claude', 'ai-memory', 'projects', hashPath(cwd));
}

/**
 * Hash path for consistent project identification
 */
function hashPath(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get age in days
 */
function getAgeInDays(timestamp) {
  if (!timestamp) return 0;
  const created = new Date(timestamp);
  const now = new Date();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

/**
 * Generate human-readable summary
 */
function generateSummary(changes) {
  const counts = {};
  for (const change of changes) {
    counts[change.type] = (counts[change.type] || 0) + 1;
  }
  
  return counts;
}

/**
 * Get compaction statistics
 */
export function getCompactionStats(scope = 'project') {
  const storagePath = getStoragePath(scope);
  const experiencesDir = join(storagePath, 'experiences');
  const archiveDir = join(storagePath, 'archive');
  
  const stats = {
    scope,
    active: 0,
    archived: 0,
    last_compaction: null,
    needs_compaction: false
  };
  
  if (existsSync(experiencesDir)) {
    stats.active = readdirSync(experiencesDir).filter(f => f.endsWith('.json')).length;
  }
  
  if (existsSync(archiveDir)) {
    stats.archived = readdirSync(archiveDir).filter(f => f.endsWith('.json')).length;
  }
  
  const metaPath = join(storagePath, 'compaction.json');
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
      stats.last_compaction = meta.last_compaction;
      
      // Check if compaction is needed (older than 7 days)
      if (meta.last_compaction) {
        const daysSince = getAgeInDays(meta.last_compaction);
        stats.needs_compaction = daysSince > 7;
      }
    } catch {}
  }
  
  return stats;
}
