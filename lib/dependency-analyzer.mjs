#!/usr/bin/env node
/**
 * dependency-analyzer.mjs — Analyze file dependencies for consequence prediction
 * Uses Grep to find import/require references across the project
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, relative, dirname } from 'path';
import { detectProject } from './detect-project.mjs';

/**
 * Find all files that import or reference a target file
 * @param {string} targetFile - relative or absolute path to target file
 * @returns {string[]} - array of files that reference the target
 */
export function findReferencingFiles(targetFile) {
  const project = detectProject();
  const root = project.project_root;
  
  // Normalize target file path
  const absoluteTarget = resolve(targetFile);
  const relativeTarget = relative(root, absoluteTarget).replace(/\\/g, '/');
  
  // Extract file name without extension for import matching
  const fileName = relativeTarget.split('/').pop();
  const baseName = fileName.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
  
  const references = new Set();
  
  try {
    // Method 1: Search for direct imports of the file path
    const pathPatterns = [
      relativeTarget,
      relativeTarget.replace(/\.[^.]+$/, ''), // without extension
      fileName,
      fileName.replace(/\.[^.]+$/, '')
    ];
    
    for (const pattern of pathPatterns) {
      try {
        const result = execSync(
          `git grep -l "from ['\"].*${escapeRegex(pattern)}['\"]" -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.mjs" "*.vue" "*.py"`,
          { cwd: root, encoding: 'utf8', timeout: 5000, stdio: 'pipe' }
        );
        
        result.split('\n').forEach(line => {
          if (line.trim()) references.add(line.trim());
        });
      } catch {
        // git grep exits 1 when no matches found
      }
    }
    
    // Method 2: Search for import of base name (for index files, etc.)
    if (baseName !== fileName) {
      try {
        const result = execSync(
          `git grep -l "from ['\"].*${escapeRegex(baseName)}['\"]" -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.mjs" "*.vue" "*.py"`,
          { cwd: root, encoding: 'utf8', timeout: 5000, stdio: 'pipe' }
        );
        
        result.split('\n').forEach(line => {
          if (line.trim()) references.add(line.trim());
        });
      } catch {
        // No matches
      }
    }
    
    // Method 3: Search for require() patterns
    try {
      const result = execSync(
        `git grep -l "require(['\"].*${escapeRegex(baseName)}['\"])" -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.mjs" "*.cjs"`,
        { cwd: root, encoding: 'utf8', timeout: 5000, stdio: 'pipe' }
      );
      
      result.split('\n').forEach(line => {
        if (line.trim()) references.add(line.trim());
      });
    } catch {
      // No matches
    }
    
  } catch (err) {
    // Git grep not available or other error
    if (process.env.AMB_DEBUG) {
      console.error('[AMB] Dependency analysis error:', err.message);
    }
  }
  
  // Remove self-reference
  const selfRef = relative(root, absoluteTarget).replace(/\\/g, '/');
  references.delete(selfRef);
  
  return Array.from(references).sort();
}

/**
 * Find related test files for a source file
 * @param {string} targetFile - source file path
 * @returns {string[]} - test files
 */
export function findTestFiles(targetFile) {
  const project = detectProject();
  const root = project.project_root;
  
  const absoluteTarget = resolve(targetFile);
  const relativeTarget = relative(root, absoluteTarget).replace(/\\/g, '/');
  const fileName = relativeTarget.split('/').pop();
  const baseName = fileName.replace(/\.(ts|tsx|js|jsx|mjs)$/, '');
  
  const tests = new Set();
  
  try {
    // Common test file patterns
    const testPatterns = [
      `${baseName}.test.*`,
      `${baseName}.spec.*`,
      `${baseName}__tests__/*`,
      `__tests__/${baseName}.*`,
      `tests/**/${baseName}.*`
    ];
    
    for (const pattern of testPatterns) {
      try {
        const result = execSync(
          `git ls-files | grep -i "${escapeRegex(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))}"`,
          { cwd: root, encoding: 'utf8', timeout: 3000, stdio: 'pipe' }
        );
        
        result.split('\n').forEach(line => {
          if (line.trim()) tests.add(line.trim());
        });
      } catch {
        // No matches
      }
    }
  } catch {
    // Git not available
  }
  
  return Array.from(tests).sort();
}

/**
 * Analyze the scope of changes for a file edit
 * @param {string} filePath - file being edited
 * @returns {object} - analysis result
 */
export function analyzeEditImpact(filePath) {
  const project = detectProject();
  const root = project.project_root;
  
  const absolutePath = resolve(filePath);
  const relativePath = relative(root, absolutePath).replace(/\\/g, '/');
  
  // Determine file type and potential impact
  const isSourceCode = /\.(ts|tsx|js|jsx|mjs|vue|py|go|rs|java)$/.test(filePath);
  const isConfig = /\.(json|yml|yaml|toml|ini|conf)$/.test(filePath) || 
                   /(config|setup|settings)/i.test(filePath);
  const isTest = /\.(test|spec)\./.test(filePath) || /__tests__/.test(filePath);
  
  let impact = {
    file: relativePath,
    type: isTest ? 'test' : isConfig ? 'config' : 'source',
    risk_level: 'low',
    affected_files: [],
    test_files: [],
    warnings: []
  };
  
  if (!isSourceCode || isTest) {
    return impact;
  }
  
  // Find referencing files
  const references = findReferencingFiles(filePath);
  impact.affected_files = references;
  
  // Find test files
  const tests = findTestFiles(filePath);
  impact.test_files = tests;
  
  // Calculate risk level
  if (references.length === 0) {
    impact.risk_level = 'low';
    impact.warnings.push('该文件暂未被其他文件引用（孤立模块）');
  } else if (references.length <= 3) {
    impact.risk_level = 'medium';
    impact.warnings.push(`影响 ${references.length} 个引用文件`);
  } else {
    impact.risk_level = 'high';
    impact.warnings.push(`⚠️ 影响 ${references.length} 个引用文件，修改需谨慎`);
  }
  
  if (tests.length === 0) {
    impact.warnings.push('⚠️ 未发现相关测试文件');
  } else {
    impact.warnings.push(`✅ 发现 ${tests.length} 个相关测试文件`);
  }
  
  // Check for special file types
  if (/auth|login|session|token|password|security/i.test(filePath)) {
    impact.risk_level = 'high';
    impact.warnings.push('🔐 安全相关文件，修改可能影响认证/授权逻辑');
  }
  
  if (/api|route|endpoint|controller/i.test(filePath)) {
    impact.risk_level = 'high';
    impact.warnings.push('🌐 API 文件，修改可能影响接口契约');
  }
  
  if (/database|model|schema|entity/i.test(filePath)) {
    impact.risk_level = 'high';
    impact.warnings.push('🗄️ 数据层文件，修改可能影响数据库结构');
  }
  
  return impact;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Quick dependency check without full analysis
 * @param {string} filePath
 * @returns {boolean} - whether the file is widely used
 */
export function isWidelyUsed(filePath) {
  const references = findReferencingFiles(filePath);
  return references.length >= 3;
}
