#!/usr/bin/env node
/**
 * search.mjs — Search experience library
 * Usage: node search.mjs [keyword] [options]
 */

import { findExperiences, semanticSearch } from '../lib/experience-store.mjs';

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: /amb:search \u003ckeyword\u003e [options]');
    console.log('');
    console.log('Options:');
    console.log('  --tool \u003ctool\u003e     Filter by tool name');
    console.log('  --type \u003ctype\u003e     Filter by type (pitfall/error/pattern/success)');
    console.log('  --tag \u003ctag\u003e      Filter by tag');
    console.log('  --global          Include global experiences');
    console.log('  --limit \u003cn\u003e       Limit results (default: 10)');
    console.log('');
    console.log('Examples:');
    console.log('  /amb:search npm');
    console.log('  /amb:search git --type pitfall');
    console.log('  /amb:search --tool Bash --tag docker');
    process.exit(1);
  }
  
  // Parse arguments
  let keyword = '';
  const options = {
    tool: '',
    type: '',
    tags: [],
    includeGlobal: true,
    limit: 10
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[++i];
      
      switch (key) {
        case 'tool':
          options.tool = value;
          break;
        case 'type':
          options.type = value;
          break;
        case 'tag':
          options.tags.push(value);
          break;
        case 'global':
          options.includeGlobal = value !== 'false';
          break;
        case 'limit':
          options.limit = parseInt(value) || 10;
          break;
      }
    } else if (!keyword) {
      keyword = arg;
    }
  }
  
  // Search
  const criteria = {
    input: keyword,
    tool: options.tool,
    type: options.type,
    tags: options.tags,
    includeGlobal: options.includeGlobal,
    limit: options.limit
  };
  
  let results = findExperiences(criteria);
  let searchMode = 'exact';
  
  // If no exact matches, try semantic search
  if (results.length === 0 && keyword) {
    results = semanticSearch(keyword, { limit: options.limit });
    searchMode = 'semantic';
  }
  
  if (results.length === 0) {
    console.log(`🔍 No experiences found for "${keyword}"`);
    console.log('');
    console.log('Tips:');
    console.log('  • Try broader keywords');
    console.log('  • Use /amb:learn to add new experiences');
    console.log('  • Check with --global flag');
    process.exit(0);
  }
  
  console.log(`🔍 Found ${results.length} experience(s) for "${keyword}" (${searchMode} match)\n`);
  
  for (let i = 0; i < results.length; i++) {
    const exp = results[i];
    const num = i + 1;
    
    // Format header
    const scopeIcon = exp.scope === 'global' ? '🌐' : '📁';
    const typeIcon = exp.type === 'pitfall' ? '🔴' : 
                     exp.type === 'error' ? '🟡' : 
                     exp.type === 'success' ? '🟢' : '⚪';
    
    console.log(`${num}. ${typeIcon} ${scopeIcon} ${exp.id}`);
    console.log(`   Relevance: ${(exp.relevance_score * 100).toFixed(0)}% | Confidence: ${(exp.confidence * 100).toFixed(0)}% | Frequency: ${exp.frequency}`);
    
    // Tool and trigger
    if (exp.trigger.tool) {
      console.log(`   Tool: ${exp.trigger.tool}`);
    }
    if (exp.trigger.action_pattern) {
      console.log(`   Action: ${exp.trigger.action_pattern}`);
    }
    
    // Outcome
    if (exp.outcome.description) {
      console.log(`   Outcome: ${exp.outcome.description.slice(0, 80)}`);
    }
    
    // Lesson
    if (exp.lesson.what_failed) {
      console.log(`   ⚠️  ${exp.lesson.what_failed.slice(0, 80)}`);
    }
    if (exp.lesson.better_approach) {
      console.log(`   💡 ${exp.lesson.better_approach.slice(0, 80)}`);
    }
    
    // Tags
    if (exp.metadata.tags?.length > 0) {
      console.log(`   🏷️  ${exp.metadata.tags.join(', ')}`);
    }
    
    console.log('');
  }
}

main();
