#!/usr/bin/env node
import { findExperiences } from '../lib/experience-store.mjs';

const args = process.argv.slice(2);
console.log('Raw args:', args);

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
      case 'tool': options.tool = value; break;
      case 'type': options.type = value; break;
      case 'tag': options.tags.push(value); break;
      case 'global': options.includeGlobal = value !== 'false'; break;
      case 'limit': options.limit = parseInt(value) || 10; break;
    }
  } else if (!keyword) {
    keyword = arg;
  }
}

console.log('Keyword:', keyword);
console.log('Options:', options);

const criteria = {
  input: keyword,
  tool: options.tool,
  type: options.type,
  tags: options.tags,
  includeGlobal: options.includeGlobal,
  limit: options.limit
};

console.log('Criteria:', criteria);

const results = findExperiences(criteria);
console.log('Results:', results.length);

if (results.length > 0) {
  console.log('\nFirst result:', JSON.stringify(results[0], null, 2).slice(0, 500));
}
