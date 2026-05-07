#!/usr/bin/env node
/**
 * context-builder.mjs — Build context injection messages
 * Formats experiences and consequences for AI consumption
 */

/**
 * Build advice context from matched experiences and predicted consequences
 */
export function buildAdviceContext(experiences, consequences) {
  const parts = [];
  
  // Header
  parts.push('💡 AI Memory Bridge: 经验提醒');
  parts.push('');
  
  // Matched experiences
  if (experiences.length > 0) {
    parts.push('相关经验：');
    for (const exp of experiences) {
      const confidence = formatConfidence(exp.confidence);
      const freq = exp.frequency > 1 ? `（验证 ${exp.frequency} 次）` : '';
      parts.push(`  ${confidence} ${exp.lesson?.what_failed || exp.outcome?.description} ${freq}`);
      
      if (exp.lesson?.better_approach) {
        parts.push(`    → 建议：${exp.lesson.better_approach}`);
      }
      
      if (exp.metadata?.tags?.length > 0) {
        parts.push(`    🏷️ ${exp.metadata.tags.join(', ')}`);
      }
      
      parts.push('');
    }
  }
  
  // Consequences prediction
  if (consequences?.risks?.length > 0) {
    parts.push('可能后果：');
    for (const risk of consequences.risks) {
      const severity = formatSeverity(risk.severity);
      parts.push(`  ${severity} ${risk.description}`);
      if (risk.mitigation) {
        parts.push(`    → 缓解：${risk.mitigation}`);
      }
    }
    parts.push('');
  }
  
  if (consequences?.affected_files?.length > 0) {
    parts.push(`影响范围：${consequences.affected_files.length} 个文件`);
    for (const file of consequences.affected_files.slice(0, 5)) {
      parts.push(`  - ${file}`);
    }
    if (consequences.affected_files.length > 5) {
      parts.push(`  ... 还有 ${consequences.affected_files.length - 5} 个`);
    }
    parts.push('');
  }
  
  return parts.join('\n');
}

/**
 * Build loop blocking message
 */
export function buildLoopBlockMessage(loopStatus, suggestions) {
  const { formatLoopAlert, generateRecoverySuggestions } = require('./loop-detector.mjs');
  
  let message = formatLoopAlert(loopStatus);
  message += '\n\n建议方案：\n';
  
  for (const sug of suggestions) {
    message += `${sug.key}. ${sug.label}\n`;
    message += `   ${sug.action}\n\n`;
  }
  
  message += '─────────────────────\n';
  message += '🛑 已暂停执行。请回复选项字母（A/B/C/D/E）或新指令继续。';
  
  return message;
}

/**
 * Predict consequences of a planned action
 */
export async function predictConsequences(tool, input, experiences) {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  const risks = [];
  const affectedFiles = [];
  let impactAnalysis = null;
  
  // Analyze input for risky patterns
  if (tool === 'Bash') {
    // Check for destructive commands
    if (/rm\s+-rf|[Dd]elete|drop\s+table/i.test(inputStr)) {
      risks.push({
        severity: 'high',
        description: '破坏性操作，可能导致数据丢失',
        mitigation: '先备份，或使用 --dry-run 预览影响'
      });
    }
    
    // Check for network operations
    if (/curl|wget|fetch/i.test(inputStr)) {
      risks.push({
        severity: 'medium',
        description: '网络请求可能失败或返回意外数据',
        mitigation: '添加重试机制和错误处理'
      });
    }
    
    // Check for installation
    if (/npm install|pip install|cargo add/i.test(inputStr)) {
      risks.push({
        severity: 'medium',
        description: '可能引入依赖冲突或安全漏洞',
        mitigation: '使用 --legacy-peer-deps 或检查 lock 文件'
      });
    }
  }
  
  if (tool === 'Write' || tool === 'Edit') {
    // Extract file path from input
    const fileMatch = inputStr.match(/file_path["']?\s*[:=]\s*["']?([^"'\n,}]+)/) ||
                      inputStr.match(/["']?(?:file|path)?:?\s*["']?([^"'\n,}]+)/);
    const filePath = fileMatch ? fileMatch[1].trim() : null;
    
    if (filePath) {
      // Use dependency analyzer for deep analysis
      try {
        const { analyzeEditImpact } = await import('./dependency-analyzer.mjs');
        impactAnalysis = analyzeEditImpact(filePath);
        
        if (impactAnalysis.affected_files.length > 0) {
          affectedFiles.push(...impactAnalysis.affected_files);
        }
        
        // Add warnings from impact analysis
        for (const warning of impactAnalysis.warnings) {
          const severity = warning.includes('🔐') || warning.includes('⚠️') || 
                          impactAnalysis.risk_level === 'high' ? 'high' : 'medium';
          risks.push({
            severity,
            description: warning,
            mitigation: impactAnalysis.test_files.length > 0 
              ? '运行相关测试验证修改' 
              : '手动验证修改后的行为'
          });
        }
        
        // Add test file references
        if (impactAnalysis.test_files.length > 0) {
          risks.push({
            severity: 'info',
            description: `相关测试: ${impactAnalysis.test_files.slice(0, 3).join(', ')}${
              impactAnalysis.test_files.length > 3 ? ` 等 ${impactAnalysis.test_files.length} 个` : ''
            }`,
            mitigation: '修改后运行这些测试'
          });
        }
        
      } catch (err) {
        // Fallback to basic warning if analyzer fails
        if (process.env.AMB_DEBUG) {
          console.error('[AMB] Dependency analysis failed:', err.message);
        }
        
        risks.push({
          severity: 'medium',
          description: '文件修改可能影响依赖该文件的其他模块',
          mitigation: '修改前搜索引用关系，同步更新关联文件'
        });
      }
    }
  }
  
  // Cross-reference with experiences for specific risks
  for (const exp of experiences) {
    if (exp.type === 'pitfall' && exp.confidence > 0.7) {
      risks.push({
        severity: 'high',
        description: `历史踩坑：${exp.lesson?.what_failed || exp.outcome?.description}`,
        mitigation: exp.lesson?.better_approach || '参考历史经验'
      });
    }
  }
  
  return {
    risks: risks.slice(0, 6),
    affected_files: [...new Set(affectedFiles)].slice(0, 10),
    impact_analysis: impactAnalysis,
    confidence: experiences.length > 0 
      ? Math.max(...experiences.map(e => e.confidence))
      : 0.5
  };
}

function formatConfidence(score) {
  if (score >= 0.9) return '●';
  if (score >= 0.7) return '◐';
  return '○';
}

function formatSeverity(severity) {
  const map = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
    info: 'ℹ️'
  };
  return map[severity] || '⚪';
}
