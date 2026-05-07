#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { detectProject, getStoragePaths } from '../lib/detect-project.mjs';

const project = detectProject();
const paths = getStoragePaths(project);

console.log('Project:', project.project_id);
console.log('Project experiences dir:', paths.project.experiences);
console.log('Exists:', existsSync(paths.project.experiences));

if (existsSync(paths.project.experiences)) {
  const files = readdirSync(paths.project.experiences).filter(f => f.endsWith('.json'));
  console.log('Files:', files.length);
  
  for (const file of files.slice(0, 3)) {
    const exp = JSON.parse(readFileSync(resolve(paths.project.experiences, file), 'utf8'));
    console.log(`\n${file}:`);
    console.log('  input_summary:', exp.trigger?.input_summary);
    console.log('  includes "npm":', exp.trigger?.input_summary?.includes('npm'));
  }
}

// Now call findExperiences
import { findExperiences } from '../lib/experience-store.mjs';

const results1 = findExperiences({ input: 'npm' });
console.log('\nfindExperiences({input: "npm"}):', results1.length);

const results2 = findExperiences({ input: 'npm', includeGlobal: true, limit: 10 });
console.log('findExperiences({input: "npm", includeGlobal: true, limit: 10}):', results2.length);
