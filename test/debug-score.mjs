#!/usr/bin/env node
import { findExperiences } from '../lib/experience-store.mjs';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { detectProject, getStoragePaths } from '../lib/detect-project.mjs';

const project = detectProject();
const paths = getStoragePaths(project);

console.log('Project:', project.project_id);
console.log('Dir:', paths.project.experiences);

// Direct test
const files = readdirSync(paths.project.experiences).filter(f => f.endsWith('.json'));
console.log('Files:', files.length);

for (const file of files) {
  const exp = JSON.parse(readFileSync(resolve(paths.project.experiences, file), 'utf8'));
  const hasNpm = exp.trigger?.input_summary?.includes('npm');
  console.log(`${file}: input_summary="${exp.trigger?.input_summary}" includes npm=${hasNpm}`);
}

// Now test findExperiences
console.log('\n--- findExperiences test ---');
const results = findExperiences({ input: 'npm' });
console.log('Results:', results.length);

// Direct manual scoring
console.log('\n--- Manual scoring ---');
for (const file of files) {
  const exp = JSON.parse(readFileSync(resolve(paths.project.experiences, file), 'utf8'));
  let score = 0;
  if (exp.trigger?.input_summary?.includes('npm')) score += 0.3;
  score += exp.confidence * 0.1;
  console.log(`${file}: score=${score.toFixed(2)} (input_match=${exp.trigger?.input_summary?.includes('npm')}, confidence=${exp.confidence})`);
}
