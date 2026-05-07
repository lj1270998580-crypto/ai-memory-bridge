#!/usr/bin/env node
import { findExperiences } from '../lib/experience-store.mjs';

console.log("Debug: Searching for 'npm'...\n");

const results = findExperiences({
  input: 'npm',
  includeGlobal: true,
  limit: 10
});

console.log(`Found: ${results.length} results`);

if (results.length === 0) {
  console.log("\nLet's check all experiences without filtering:");
  const all = findExperiences({
    includeGlobal: true,
    limit: 100
  });
  console.log(`Total experiences: ${all.length}`);
  
  for (const exp of all.slice(0, 3)) {
    console.log(`\n--- ${exp.id} ---`);
    console.log(`  input_summary: ${exp.trigger?.input_summary}`);
    console.log(`  tags: ${exp.metadata?.tags?.join(', ')}`);
  }
}
