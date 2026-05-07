#!/usr/bin/env node
/**
 * ast-analyzer.mjs — Lightweight code analysis for impact prediction
 * Extracts functions, classes, types, and exports without external dependencies
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { execSync } from 'child_process';
import { detectProject } from './detect-project.mjs';

/**
 * Extract exported symbols from a source file
 */
export function extractSymbols(filePath) {
  if (!existsSync(filePath)) return null;
  
  const content = readFileSync(filePath, 'utf8');
  const symbols = {
    functions: [],
    classes: [],
    interfaces: [],
    types: [],
    variables: [],
    defaultExport: null,
    reExports: []
  };
  
  // Extract functions: export function foo(...) or export const foo = (...) =>
  const functionPatterns = [
    /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g,
    /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function\s*\()/g,
    /export\s+const\s+(\w+)\s*=\s*\{/g  // object with methods
  ];
  
  for (const pattern of functionPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      symbols.functions.push({
        name: match[1],
        line: content.substring(0, match.index).split('\n').length,
        signature: extractSignature(content, match.index, match[0].length)
      });
    }
  }
  
  // Extract classes
  const classPattern = /export\s+(?:default\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
  let classMatch;
  while ((classMatch = classPattern.exec(content)) !== null) {
    const classBody = extractClassBody(content, classMatch.index + classMatch[0].length);
    symbols.classes.push({
      name: classMatch[1],
      extends: classMatch[2] || null,
      line: content.substring(0, classMatch.index).split('\n').length,
      methods: classBody.methods,
      properties: classBody.properties
    });
  }
  
  // Extract interfaces
  const interfacePattern = /export\s+interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{/g;
  let interfaceMatch;
  while ((interfaceMatch = interfacePattern.exec(content)) !== null) {
    const body = extractBraces(content, interfaceMatch.index + interfaceMatch[0].length);
    symbols.interfaces.push({
      name: interfaceMatch[1],
      extends: interfaceMatch[2] ? interfaceMatch[2].split(',').map(s => s.trim()) : [],
      line: content.substring(0, interfaceMatch.index).split('\n').length,
      members: extractInterfaceMembers(body)
    });
  }
  
  // Extract type aliases
  const typePattern = /export\s+type\s+(\w+)\s*=/g;
  let typeMatch;
  while ((typeMatch = typePattern.exec(content)) !== null) {
    symbols.types.push({
      name: typeMatch[1],
      line: content.substring(0, typeMatch.index).split('\n').length
    });
  }
  
  // Extract exported variables/constants
  const varPattern = /export\s+(?:const|let|var)\s+(\w+)/g;
  let varMatch;
  while ((varMatch = varPattern.exec(content)) !== null) {
    symbols.variables.push({
      name: varMatch[1],
      line: content.substring(0, varMatch.index).split('\n').length
    });
  }
  
  // Extract default export
  const defaultPattern = /export\s+default\s+(?:class|function)?\s*(\w+)?/;
  const defaultMatch = content.match(defaultPattern);
  if (defaultMatch) {
    symbols.defaultExport = defaultMatch[1] || 'default';
  }
  
  // Extract re-exports
  const reExportPattern = /export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let reExportMatch;
  while ((reExportMatch = reExportPattern.exec(content)) !== null) {
    symbols.reExports.push({
      names: reExportMatch[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]),
      from: reExportMatch[2]
    });
  }
  
  return symbols;
}

/**
 * Extract class body (methods and properties)
 */
function extractClassBody(content, startIdx) {
  const body = extractBraces(content, startIdx);
  const methods = [];
  const properties = [];
  
  // Method patterns
  const methodPattern = /(?:async\s+)?(?:get\s+|set\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g;
  let match;
  while ((match = methodPattern.exec(body)) !== null) {
    methods.push(match[1]);
  }
  
  // Property patterns (class fields)
  const propPattern = /(?:private\s+|protected\s+|public\s+)?(?!constructor)(\w+)\s*[:=]/g;
  while ((match = propPattern.exec(body)) !== null) {
    if (!methods.includes(match[1])) {
      properties.push(match[1]);
    }
  }
  
  return { methods: [...new Set(methods)], properties: [...new Set(properties)] };
}

/**
 * Extract interface members
 */
function extractInterfaceMembers(body) {
  const members = [];
  const lines = body.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '}') continue;
    
    // Match: name: type or name?: type or name(args): type
    const match = trimmed.match(/^(\w+)\??\s*[:\(]/);
    if (match) {
      members.push(match[1]);
    }
  }
  
  return members;
}

/**
 * Extract text within matching braces
 */
function extractBraces(content, startIdx) {
  let depth = 1;
  let idx = startIdx;
  
  while (depth > 0 && idx < content.length) {
    if (content[idx] === '{') depth++;
    else if (content[idx] === '}') depth--;
    idx++;
  }
  
  return content.substring(startIdx, idx - 1);
}

/**
 * Extract function signature (first line)
 */
function extractSignature(content, startIdx, matchLen) {
  const lineStart = content.lastIndexOf('\n', startIdx) + 1;
  const lineEnd = content.indexOf('\n', startIdx);
  return content.substring(lineStart, lineEnd > 0 ? lineEnd : content.length).trim();
}

/**
 * Find all files that use a specific symbol
 */
export function findSymbolReferences(symbolName, filePath) {
  const project = detectProject();
  const root = project.project_root;
  const references = [];
  
  try {
    // Use git grep for fast project-wide search
    const result = execSync(
      `git grep -n "${symbolName}" -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.vue"`,
      { cwd: root, encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    );
    
    for (const line of result.split('\n')) {
      if (!line.trim()) continue;
      
      const [file, lineNum, ...rest] = line.split(':');
      const text = rest.join(':');
      
      // Filter out definition lines and comments
      if (text.includes(`function ${symbolName}`) || 
          text.includes(`class ${symbolName}`) ||
          text.includes(`interface ${symbolName}`) ||
          text.includes(`//`) && text.indexOf(symbolName) > text.indexOf('//')) {
        continue;
      }
      
      // Check if it's a real usage (not just string occurrence)
      if (isRealUsage(text, symbolName)) {
        references.push({
          file: file.trim(),
          line: parseInt(lineNum),
          context: text.trim().substring(0, 100)
        });
      }
    }
  } catch {
    // No matches or git not available
  }
  
  return references;
}

/**
 * Check if symbol name is a real code usage (not in string/comment)
 */
function isRealUsage(line, symbolName) {
  const idx = line.indexOf(symbolName);
  if (idx < 0) return false;
  
  // Check if in string
  const before = line.substring(0, idx);
  const quotes = (before.match(/"/g) || []).length;
  if (quotes % 2 === 1) return false; // Inside string
  
  const singleQuotes = (before.match(/'/g) || []).length;
  if (singleQuotes % 2 === 1) return false;
  
  // Check if in comment
  if (before.includes('//')) return false;
  
  return true;
}

/**
 * Analyze impact of editing a specific file
 * Enhanced version with AST-level analysis
 */
export function analyzeCodeImpact(filePath) {
  const symbols = extractSymbols(filePath);
  if (!symbols) return null;
  
  const impact = {
    file: filePath,
    exportedSymbols: [],
    breakingChanges: [],
    affectedReferences: [],
    testFiles: [],
    risk: 'low'
  };
  
  // Analyze each exported symbol
  for (const func of symbols.functions) {
    impact.exportedSymbols.push({ type: 'function', name: func.name });
    
    const refs = findSymbolReferences(func.name, filePath);
    if (refs.length > 0) {
      impact.affectedReferences.push({
        symbol: func.name,
        type: 'function',
        count: refs.length,
        locations: refs.slice(0, 5)
      });
    }
  }
  
  for (const cls of symbols.classes) {
    impact.exportedSymbols.push({ type: 'class', name: cls.name });
    
    const refs = findSymbolReferences(cls.name, filePath);
    if (refs.length > 0) {
      impact.affectedReferences.push({
        symbol: cls.name,
        type: 'class',
        count: refs.length,
        locations: refs.slice(0, 5)
      });
    }
    
    // Check class methods
    for (const method of cls.methods) {
      const methodRefs = findSymbolReferences(method, filePath);
      if (methodRefs.length > 0) {
        impact.affectedReferences.push({
          symbol: `${cls.name}.${method}`,
          type: 'method',
          count: methodRefs.length,
          locations: methodRefs.slice(0, 3)
        });
      }
    }
  }
  
  for (const iface of symbols.interfaces) {
    impact.exportedSymbols.push({ type: 'interface', name: iface.name });
    
    const refs = findSymbolReferences(iface.name, filePath);
    if (refs.length > 0) {
      impact.affectedReferences.push({
        symbol: iface.name,
        type: 'interface',
        count: refs.length,
        locations: refs.slice(0, 5)
      });
    }
    
    // Interface members are breaking changes
    impact.breakingChanges.push({
      type: 'interface-members',
      interface: iface.name,
      members: iface.members,
      risk: 'high'
    });
  }
  
  for (const type of symbols.types) {
    impact.exportedSymbols.push({ type: 'type', name: type.name });
    
    const refs = findSymbolReferences(type.name, filePath);
    if (refs.length > 0) {
      impact.affectedReferences.push({
        symbol: type.name,
        type: 'type',
        count: refs.length,
        locations: refs.slice(0, 5)
      });
    }
  }
  
  // Calculate total affected references
  const totalRefs = impact.affectedReferences.reduce((sum, ref) => sum + ref.count, 0);
  
  // Risk assessment
  if (impact.breakingChanges.length > 0) {
    impact.risk = 'high';
  } else if (totalRefs >= 5) {
    impact.risk = 'high';
  } else if (totalRefs >= 2) {
    impact.risk = 'medium';
  }
  
  impact.totalReferences = totalRefs;
  
  return impact;
}

/**
 * Format impact analysis for display
 */
export function formatImpactAnalysis(impact) {
  if (!impact || !impact.exportedSymbols.length) {
    return '⚠️ 无法分析文件内容（可能不是源码文件）';
  }
  
  const parts = [];
  
  parts.push(`📊 代码影响分析: ${impact.file}`);
  parts.push('');
  
  // Exported symbols
  parts.push(`导出符号 (${impact.exportedSymbols.length}):`);
  for (const sym of impact.exportedSymbols) {
    parts.push(`  ${sym.type}: ${sym.name}`);
  }
  parts.push('');
  
  // Risk level
  const riskEmoji = impact.risk === 'high' ? '🔴' : impact.risk === 'medium' ? '🟡' : '🟢';
  parts.push(`${riskEmoji} 风险等级: ${impact.risk.toUpperCase()}`);
  parts.push(`   影响引用: ${impact.totalReferences} 处`);
  parts.push('');
  
  // Affected references
  if (impact.affectedReferences.length > 0) {
    parts.push('影响位置:');
    for (const ref of impact.affectedReferences.slice(0, 5)) {
      parts.push(`  ${ref.symbol} (${ref.count} 次引用)`);
      for (const loc of ref.locations.slice(0, 2)) {
        parts.push(`    → ${loc.file}:${loc.line}`);
      }
      if (ref.count > 2) {
        parts.push(`    ... 还有 ${ref.count - 2} 处`);
      }
    }
    parts.push('');
  }
  
  // Breaking changes
  if (impact.breakingChanges.length > 0) {
    parts.push('⚠️ 破坏性变更风险:');
    for (const bc of impact.breakingChanges) {
      if (bc.type === 'interface-members') {
        parts.push(`  接口 ${bc.interface} 有 ${bc.members.length} 个成员`);
        parts.push(`    修改成员将导致所有实现该接口的代码报错`);
      }
    }
    parts.push('');
  }
  
  return parts.join('\n');
}
